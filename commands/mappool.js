const axios = require('axios');
const gh = require('parse-github-url');

function get_lines_between(arr, beginning, ending) {
    let beginning_line = arr.length-1;
    let ending_line = arr.length-1;
    for (let l = 0; l<arr.length; l++) {
        if (beginning_line !== arr.length-1 && arr[l].startsWith(ending)) {
            ending_line = l;
        }
        if (arr[l].startsWith(beginning)) {
            beginning_line = l;
        }
    }
    return arr.slice(beginning_line, ending_line);
}

module.exports = {
    command: ["mappool", "pool"],
    requiredPerms: ["MANAGE_GUILD"],
    call: obj => {
        return new Promise((resolve, reject) => {
            let {argv, msg, helper, config} = obj;
            let action = argv[1] ? argv[1] : "";
            if (action === "add") {
                let tournament = argv[2];
                let stage = argv[3];
                let url = argv[4];

                if(!module.exports.requiredPerms.some(perm => msg.member.hasPermission(perm)))
                    reject(`You must have ${module.exports.requiredPerms} perm to add map.`)

                if(!url || !stage || !tournament) {
                    reject("Please specify all parameters.")
                }

                let beatmap_id = helper.parse_beatmap_url(url)
                if (!beatmap_id)
                    reject("Please enter beatmap URL correctly.")

                if (!helper.database.hasOwnProperty(msg.guild.id))
                    helper.database[msg.guild.id] = {}

                if (!helper.database[msg.guild.id].hasOwnProperty(tournament))
                    helper.database[msg.guild.id][tournament] = {}

                if (!helper.database[msg.guild.id][tournament].hasOwnProperty(stage)) {
                    helper.database[msg.guild.id][tournament][stage] = []
                    helper.active_stage[msg.guild.id] = [tournament, stage]
                }

                helper.get_beatmap({b: beatmap_id}).then(response => {
                    if (response.data.length < 1)
                        reject("Map is not found.")

                    let beatmap = response.data[0];
                    let map = `${beatmap["artist"]} - ${beatmap["title"]} [${beatmap["version"]}]`;

                    if (helper.database[msg.guild.id][tournament][stage].find(m => m["id"] === beatmap_id))
                        reject(`This map is already in pool!`)

                    helper.database[msg.guild.id][tournament][stage].push({
                        id: beatmap_id,
                        mapset_id: beatmap["beatmapset_id"],
                        map,
                        scores: []
                    })
                    resolve({
                        embed: {
                            color: [0, 255, 0],
                            title: `${stage} ◄ ${tournament}`,
                            thumbnail: {
                                url: `https://b.ppy.sh/thumb/${beatmap["beatmapset_id"]}l.jpg`
                            },
                            description: `Successfully **added** ${map} into database!`,
                            timestamp: new Date(),
                            footer: {
                                text: `Mapped by ${beatmap["creator"]}`,
                                icon_url: `https://a.ppy.sh/${beatmap["creator_id"]}?${Date.now()}`
                            }
                        }
                    })
                })
            } else if (action === "remove") {
                let tournament = argv[2];
                let stage = argv[3];
                let url = argv[4];

                if(!module.exports.requiredPerms.some(perm => msg.member.hasPermission(perm)))
                    reject(`You must have ${module.exports.requiredPerms} perm to remove map.`)

                if(url) {
                    let beatmap_id = helper.parse_beatmap_url(url)
                    if (!beatmap_id)
                        reject("Please enter beatmap URL correctly.")

                    if (helper.database.hasOwnProperty(msg.guild.id)
                        && helper.database[msg.guild.id].hasOwnProperty(tournament)
                        && helper.database[msg.guild.id][tournament].hasOwnProperty(stage)) {

                        helper.get_beatmap({b: beatmap_id}).then(response => {
                            if (response.data.length < 1)
                                reject("Map is not found.")

                            let beatmap = response.data[0];
                            let map = `${beatmap["artist"]} - ${beatmap["title"]} [${beatmap["version"]}]`;
                            let mapIndex = helper.database[msg.guild.id][tournament][stage].findIndex(m => m["id"] === beatmap_id);
                            if (mapIndex > -1) {
                                helper.database[msg.guild.id][tournament][stage].splice(mapIndex, 1);
                                resolve({
                                    embed: {
                                        color: [255, 0, 0],
                                        title: `${stage} ◄ ${tournament}`,
                                        thumbnail: {
                                            url: `https://b.ppy.sh/thumb/${beatmap["beatmapset_id"]}l.jpg`
                                        },
                                        description: `Successfully **removed** ${map} from database!`,
                                        timestamp: new Date(),
                                        footer: {
                                            text: `Mapped by ${beatmap["creator"]}`,
                                            icon_url: `https://a.ppy.sh/${beatmap["creator_id"]}?${Date.now()}`
                                        }
                                    }
                                })
                            } else
                                reject("Cannot find map in this pool.")

                        })
                    } else reject("Cannot find this pool/tournament.")
                }
                else if (!url && stage && tournament) {
                    if (helper.database[msg.guild.id][tournament][stage]) {
                        delete helper.database[msg.guild.id][tournament][stage];
                        if (helper.active_stage[msg.guild.id] === [tournament, stage]) {
                             delete helper.active_stage[msg.guild.id]
                        }
                        resolve({
                            embed: {
                                color: [255, 0, 0],
                                title: `${stage} ◄ ${tournament}`,
                                description: `Successfully **removed** ${stage} stage from ${tournament}!`,
                                timestamp: new Date(),
                            }
                        })
                    }
                    else reject(`Couldn't find ${stage}/${tournament} in database.`)
                }
                else if (!url && !stage && tournament) {
                    if (helper.database[msg.guild.id][tournament]) {
                        delete helper.database[msg.guild.id][tournament];
                        if (helper.active_stage[msg.guild.id][0] === tournament) {
                            delete helper.active_stage[msg.guild.id]
                        }
                        resolve({
                            embed: {
                                color: [255, 0, 0],
                                title: `${tournament}`,
                                description: `Successfully **removed** ${tournament} from database!`,
                                timestamp: new Date(),
                            }
                        })
                    }
                    else reject(`Couldn't find ${tournament} in database.`)
                }
                else {
                    reject("Please specify what to delete.")
                }
            } else if (action === "list") {
                let tournament = argv[2];
                let stage = argv[3];

                if((!tournament && !stage) && helper.active_stage.hasOwnProperty(msg.guild.id)) {
                    tournament = helper.active_stage[msg.guild.id][0];
                    stage = helper.active_stage[msg.guild.id][1];
                }

                let description = "";
                if(stage) {
                    if (helper.database[msg.guild.id][tournament]
                        && helper.database[msg.guild.id][tournament][stage]) {
                        helper.database[msg.guild.id][tournament][stage].forEach(map => {
                            let best = map["scores"].length > 0 ? map["scores"].sort((a,b) => {return b["score"]-a["score"]})[0] : 0;
                            let highScore = best["score"] > 0 ? `- **${best["score"]}** by **${best["player"]}**` : "";
                            description += `\n • [${map["map"]}](https://osu.ppy.sh/b/${map["id"]}) ${highScore}`;
                        })
                        resolve({
                            embed: {
                                color: config.accent_color,
                                title: `Map list of ${stage} ◄ ${tournament}`,
                                description,
                                timestamp: new Date(),
                            }
                        })
                    }
                }
                else if (!stage && tournament) {
                    if (helper.database[msg.guild.id][tournament]) {
                        Object.keys(helper.database[msg.guild.id][tournament]).forEach(stage => {
                            description += `\n ⮞ **${stage}** - Total of **${helper.database[msg.guild.id][tournament][stage].length}** maps.`;
                        })
                        resolve({
                            embed: {
                                color: config.accent_color,
                                title: `Stage list of ${tournament}`,
                                description,
                                timestamp: new Date(),
                            }
                        })
                    }
                    else {
                        reject(`The tournament ${tournament} is not found in database.`)
                    }
                }
                else {
                    reject("Cannot find anything to list.")
                }
            } else if (action === "github") {
                let tournament = argv[2];
                let stage = argv[3];
                let url = argv[4];

                if(!module.exports.requiredPerms.some(perm => msg.member.hasPermission(perm)))
                    reject(`You must have ${module.exports.requiredPerms} perm to add map.`)

                if(!url || !stage || !tournament) {
                    reject("Please specify all parameters.")
                }

                let github_data = gh(url);

                if (!github_data.repo || !github_data.filepath)
                    reject("Please enter github url correctly.")

                const jsdelivr_url = `https://cdn.jsdelivr.net/gh/${github_data.repo}/${github_data.filepath}`;
                axios.get(jsdelivr_url).then(response => {
                    let lines = response.data.split(/\r?\n/);
                    let pool = get_lines_between(lines, "## Mappools", "## ");
                    let map_list = get_lines_between(pool, `### ${stage}`, "### ").join("\n");
                    let urlRegex = new RegExp(/((http|ftp|https):\/\/)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g)
                    let maps = map_list.match(urlRegex);
                    let promises = [];
                    let add_array = [];
                    let added = 0;
                    maps.forEach(map_url => {
                        let beatmap_id = helper.parse_beatmap_url(map_url)
                        if (beatmap_id) {
                            if (!helper.database.hasOwnProperty(msg.guild.id))
                                helper.database[msg.guild.id] = {}

                            if (!helper.database[msg.guild.id].hasOwnProperty(tournament))
                                helper.database[msg.guild.id][tournament] = {}

                            if (!helper.database[msg.guild.id][tournament].hasOwnProperty(stage)) {
                                helper.database[msg.guild.id][tournament][stage] = []
                                helper.active_stage[msg.guild.id] = [tournament, stage]
                            }

                            promises.push(helper.get_beatmap({b: beatmap_id}).then(response => {
                                if (response.data.length > 0) {
                                    let beatmap = response.data[0];
                                    let map = `${beatmap["artist"]} - ${beatmap["title"]} [${beatmap["version"]}]`;

                                    if (!helper.database[msg.guild.id][tournament][stage].find(m => m["id"] === beatmap_id)) {
                                        add_array.push({
                                            id: beatmap_id,
                                            mapset_id: beatmap["beatmapset_id"],
                                            map,
                                            scores: []
                                        })
                                        added++;
                                    }
                                }
                            }))
                        }
                    })
                    Promise.all(promises).then(() => {
                        add_array.sort((a, b) => {
                            return maps.findIndex(m => m.includes(a["id"])) - maps.findIndex(m => m.includes(b["id"]));
                        })
                        helper.database[msg.guild.id][tournament][stage] =
                            helper.database[msg.guild.id][tournament][stage].concat(add_array);
                        resolve({
                            embed: {
                                color: [0, 255, 0],
                                title: `${stage} ◄ ${tournament}`,
                                description: `Successfully **added** ${added} map(s) to database!`,
                                timestamp: new Date(),
                            }
                        })
                    })
                })
            } else {
                reject("Please specify your action correctly (add, remove, list, github).")
            }
        })
    }
}