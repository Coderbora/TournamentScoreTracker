const requestImageSize = require('request-image-size')

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

module.exports = {
    command: ["score", "submit", "sb"],
    call: obj => {
        return new Promise(async (resolve, reject) => {
            let {msg, infoscheduler, digitscheduler, config} = obj;
            if (msg.attachments.size > 0) {
                let attachment = msg.attachments.first();
                if (attachment.name.match(/[^/]+(jpg|jpeg|png)$/)) {
                    let dimensions = await requestImageSize(attachment.url);
                    let settings = buildSettings(dimensions.width, dimensions.height);

                    let data = {
                        player: "",
                        map: "",
                        mapper: "",
                        date: "",
                        score: ""
                    }

                    let jobs = [
                        infoscheduler.addJob('recognize', attachment.url, {rectangle: settings.map_player_info}),
                        digitscheduler.addJob('recognize', attachment.url, {rectangle: settings.score})
                    ]

                    Promise.all(jobs).then(results => {
                        let title = results[0].data.text;
                        if (title.match(/Played by (.*) on/) && title.match(/Beatmap by (.*)/) && title.match(/on (.*)./)) {
                            data.player = title.match(/Played by (.*) on/)[1];
                            data.map = title.split("\n")[0];
                            data.mapper = title.match(/Beatmap by (.*)/)[1];
                            data.date = title.match(new RegExp("Played by " + data.player + " on (.*)."))[1];
                            console.log(results[1].data.text)
                            data.score = results[1].data.text.length > 7 ?
                                Number(results[1].data.text.substring(results[1].data.text.length - 8)) :
                                Number(results[1].data.text);

                            if (isNaN(data.score))
                                reject("Failed to read your score. Please upload your replay instead of uploading screenshot.")

                            let embed = {
                                color: config.accent_color,
                                title: "Confirm the action",
                                description: "Are you sure to add this score into database?",
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

                            resolve({
                                embed,
                                reaction_array: [
                                    {
                                        emoji: "✅",
                                        call: () => {
                                            return new Promise((resolve) => {
                                                embed.footer.text = `Accepted by ${msg.author.username}`;
                                                embed.timestamp = new Date();
                                                resolve({
                                                    edit_promise : {embed}
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
                                                resolve({
                                                    edit_promise : {embed}
                                                })
                                            })
                                        }
                                    }
                                ]
                            })
                        } else reject("Failed to parse beatmap title data. Please upload your replay instead of uploading screenshot.")
                    }).catch(err => reject(err))
                }
            }
        })
    }
}