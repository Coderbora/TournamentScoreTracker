const stringSimilarity = require('string-similarity');

function generateScoreEmbed(map, index, config) {
    const current = map["scores"].slice(index, index + 10)
    let scores = [];
    let i = 0;
    current.forEach(s => {
        scores.push(`**${index + i + 1}.** [${s["player"]}](https://osu.ppy.sh/u/${s["player"]})` +
            ` - **${s["score"]}** - ${s["date"]}`)
        i++;
    })
    return {
        color: config.accent_color,
        timestamp: new Date(),
        description: scores.join("\n\n"),
        title: `${map["map"]}`,
        url: `https://osu.ppy.sh/b/${map["id"]}`,
        footer: {
            text: `Showing ${index + 1} - ${index + current.length} out of ${map["scores"].length}`
        },
        thumbnail: {
            url: `https://b.ppy.sh/thumb/${map["mapset_id"]}l.jpg`
        }
    }
}

let currentIndex = 0;

module.exports = {
    command: ["list", "scores", "score"],
    description: "List scores for a map.",
    usage: "[map name] (player)",
    call: obj => {
        return new Promise((resolve, reject) => {
            let {argv, msg, helper, config} = obj;

            let search_string = argv[1];
            let user = argv[2];

            if (!search_string)
                reject("Please enter map's name.")

            let guild_stage = helper.active_stage[msg.guild.id];
            if (guild_stage) {
                let similar_map = helper.database[msg.guild.id][guild_stage[0]][guild_stage[1]]
                    .slice(0).sort((a, b) => {
                        return stringSimilarity.compareTwoStrings(b["map"], search_string)
                            - stringSimilarity.compareTwoStrings(a["map"], search_string)
                    })[0];

                if (user)
                    similar_map["scores"] = similar_map["scores"].filter(s => s["player"] === user);

                similar_map["scores"].sort((a, b) => {
                    return b - a;
                })

                if (similar_map["scores"].length === 0)
                    reject("No scores found.")


                let res = {
                    embed: generateScoreEmbed(similar_map, currentIndex, config),
                }
                if (similar_map["scores"].length > 10) {
                    Object.assign(res, {
                        page: {
                            back: () => {
                                if (currentIndex >= 10) {
                                    currentIndex -= 10;
                                    return {
                                        embed: generateScoreEmbed(similar_map, currentIndex, config)
                                    }
                                }
                            },
                            fwd: () => {
                                if (currentIndex < Math.floor(similar_map["scores"].length / 10) * 10) {
                                    currentIndex += 10;
                                    return {
                                        embed: generateScoreEmbed(similar_map, currentIndex, config)

                                    }
                                }
                            }
                        }
                    })
                }
                resolve(res)

            } else
                reject(`There is no currently active stage.`)
        })
    }
}