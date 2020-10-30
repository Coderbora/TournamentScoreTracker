module.exports = {
    command: ["mp", "multiplayer"],
    requiredPerms: ["MANAGE_GUILD"],
    description: "Load scores to active stage from multiplayer lobby url.",
    usage: "[mp url] (ignore players...)",
    call: obj => {
        return new Promise((resolve, reject) => {
            let { argv, msg, helper } = obj;

            if(!module.exports.requiredPerms.some(perm => msg.member.hasPermission(perm)))
                reject(`You must have ${module.exports.requiredPerms} perm to add map.`)

            let guild_stage = helper.active_stage[msg.guild.id];

            let mp_url = argv[1];
            let player_ignore_array = argv.slice(2);
            if(!mp_url || !helper.validURL(mp_url) || !helper.parse_multiplayer_id(mp_url))
                reject("Please enter mp url correctly.")
            else if(!guild_stage)
                reject("There is no active stage.")
            else {
                let mp_id = helper.parse_multiplayer_id(mp_url);
                helper.get_multiplayer({ mp : mp_id }).then(async res => {
                    if (res.data.match === 0)
                        reject("Multiplayer url is not valid.")
                    else {
                        let mp = res.data;
                        let score_promises = [];
                        let users = {};
                        mp["games"].filter(game => helper.database[msg.guild.id]
                            [guild_stage[0]][guild_stage[1]]["maps"]
                            .find(map => map["id"] === Number(game["beatmap_id"]))).forEach(game => {
                            game["scores"].forEach(score => {
                                Promise.resolve(new Promise(resolve => {
                                    if(!users.hasOwnProperty(score["user_id"])) {
                                        helper.get_user({ u: score["user_id"]}).then(user => {
                                            users[score["user_id"]] = user.data[0]["username"]
                                            resolve()
                                        })
                                    } else resolve()
                                })).then(() => {
                                    if(!player_ignore_array.includes(users[score["user_id"]]))
                                        score_promises.push(helper.add_score(msg, {
                                            id: Number(game["beatmap_id"]),
                                            player: users[score["user_id"]],
                                            date: game["end_time"],
                                            score: score["score"]
                                        }))
                                })
                            })
                        });

                        Promise.all(score_promises).then(() => {
                            resolve({
                                embed: {
                                    color: [0, 255, 0],
                                    title: `${guild_stage[1]} ◄ ${guild_stage[0]}`,
                                    description: `Successfully **added** multiplayer scores to database!`,
                                    timestamp: new Date(),
                                }
                            })
                        }).catch(err => reject(err));
                    }
                })
            }

        })
    }
}
