const requestImageSize = require('request-image-size')
const {DateTime} = require("luxon");
const stringSimilarity = require('string-similarity');

const fs = require('fs')
const path = require('path')
const os = require('os')

const default_settings = {
    dimensions: [1366, 768],
    map_player_info: {
        left: 1,
        top: 1,
        width: 950,
        height: 100,
    },
    score: {
        left: 10,
        top: 105,
        width: 630,
        height: 80
    }
}

function validURL(str) {
    let pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

function scaleRectangles(settings, w, h) {
    const ratio = [w / settings.dimensions[0], h / settings.dimensions[1]];

    settings.map_player_info.width *= ratio[0]
    settings.map_player_info.height *= ratio[1]

    settings.score.left *= ratio[0]
    settings.score.top *= ratio[1]
    settings.score.width *= ratio[0]
    settings.score.height *= ratio[1]
    return settings;
}

function buildSettings(w, h) {
    return scaleRectangles(JSON.parse(JSON.stringify(default_settings)), w, h)
}

function formatResolve(data, msg, config, helper) {
    let embed = {
        color: config.accent_color,
        title: "Confirm the action",
        description: "Are you sure to add this score into database? " +
            "Please check all informations listed below. " +
            "If something is wrong, you should use a proper replay file.",
        fields: [
            {
                name: "Player",
                value: data.player,
                inline: true
            },
            {
                name: "Score",
                value: data.score,
                inline: true
            },
            {
                name: "Date",
                value: data.date,
                inline: true
            },
            {
                name: "Mapper",
                value: data.mapper,
                inline: true
            },
            {
                name: "Map",
                value: data.map,
                inline: true
            }
        ],
        timestamp: new Date(),
        footer: {
            text: "Action waiting..."
        }
    };
    return {
        embed,
        reaction: {
            reactions: [
                {
                    emoji: "✅",
                    call: () => {
                        return new Promise((resolve) => {
                            embed.footer.text = `Accepted by ${msg.author.username}`;
                            embed.timestamp = new Date();
                            embed.color = [0, 255, 0];
                            helper.add_score(msg, data);
                            resolve({
                                edit_promise: {embed}
                            })
                        })
                    }
                },
                {
                    emoji: "❌",
                    call: () => {
                        return new Promise((resolve) => {
                            embed.footer.text = `Declined by ${msg.author.username}`;
                            embed.timestamp = new Date();
                            embed.color = [255, 0, 0];
                            resolve({
                                edit_promise: {embed}
                            })
                        })
                    }
                }
            ],
            timeout: () => {
                return new Promise((resolve) => {
                    embed.footer.text = `Operation timed out.`;
                    embed.timestamp = new Date();
                    embed.color = [255, 0, 0];
                    resolve({
                        edit_promise: {embed}
                    })
                })
            }
        }
    }
}

module.exports = {
    command: ["submit", "sb", "s"],
    description: "Upload your score into database.",
    usage: "[url] or upload ranking screen/replay",
    call: obj => {
        return new Promise(async (resolve, reject) => {
            let {argv, msg, ocr, config, helper} = obj;

            let data = {};

            let guild_stage = helper.active_stage[msg.guild.id]
            if (!guild_stage)
                reject("Please set an active stage.")

            if ((msg.attachments.size > 0 && msg.attachments.first().name.match(/[^/]+(jpg|jpeg|png)$/))
                || (argv[1] && validURL(argv[1]))) {
                let url;

                if (msg.attachments.size > 0)
                    url = msg.attachments.first().url
                else
                    url = argv[1]

                let dimensions = await requestImageSize(url).catch(() => {
                    reject("Cannot get image headers for this image path.")
                });
                let settings = buildSettings(dimensions.width, dimensions.height);

                let jobs = [
                    ocr.detectText(url, "text", settings.map_player_info, [dimensions.width, dimensions.height]),
                    ocr.detectText(url, "digit", settings.score, [dimensions.width, dimensions.height])
                ]

                Promise.all(jobs).then(results => {
                    let title = results[0];
                    if (title.match(/Played by (.*) on/) && title.match(/Beatmap by (.*)/) && title.match(/on (.*)./)) {
                        data.player = title.match(/Played by (.*) on/)[1];
                        data.map = title.split("\n")[0];
                        data.mapper = title.match(/Beatmap by (.*)/)[1];
                        data.date = title.match(new RegExp("Played by " + data.player + " on (.*)."))[1];
                        data.score = results[1].length > 7 ?
                            Number(results[1].substring(results[1].length - 8)) :
                            Number(results[1]); // preventing extra digits for score v2

                        if (isNaN(data.score))
                            reject("Failed to read your score. " +
                                "Please upload your replay instead of uploading screenshot.")

                        let similar_map = helper.database[msg.guild.id][guild_stage[0]][guild_stage[1]]["maps"]
                            .slice(0).sort((a, b) => {
                                    return stringSimilarity.compareTwoStrings(b["map"], data.map)
                                        - stringSimilarity.compareTwoStrings(a["map"], data.map)
                            })[0];

                        data.map = similar_map["map"]
                        data.id = similar_map["id"]

                        resolve(formatResolve(data, msg, config, helper))

                    } else reject("Failed to parse beatmap title data. " +
                        "Please upload your replay instead of uploading screenshot.")
                }).catch(err => reject(err))
            } else if (msg.attachments.size > 0 && msg.attachments.first().name.match(/[^/]+(osr)$/)
                && msg.attachments.first().size > 256) {
                let process = Math.floor(Math.random() * 1000000)
                let replayPath = path.join(os.tmpdir(), "replays", `${process}.osr`);
                helper.download_file(msg.attachments.first().url, replayPath).then(() => {
                    let replay = helper.parse_replay(replayPath)
                    data.score = replay.score;
                    data.player = replay.playerName;
                    data.date = DateTime.fromISO(replay.timestamp.toISOString())
                        .toFormat("d.MM.yyyy HH:mm:ss");
                    helper.get_beatmap({h: replay["beatmapMD5"]}).then(maplist => {
                        fs.unlinkSync(replayPath)
                        if (maplist.data.length > 0) {
                            let map = maplist.data[0];
                            data.mapper = map["creator"];
                            data.map = `${map["artist"]} - ${map["title"]} [${map["version"]}]`;
                            data.id = map["beatmap_id"];

                            if(!helper.database[msg.guild.id][guild_stage[0]][guild_stage[1]]["maps"].find(m => m["id"] === data.id))
                                reject(`Failed to find this map in mappool.`)

                            resolve(formatResolve(data, msg, config, helper))
                        } else
                            reject(`Failed to find this replay's map in osu!. Please try saving another replay.`)
                    })
                }).catch(err => reject(err))
            } else reject("Please either specify the image or upload your replay properly (>2KB).")
        })
    }
    }