const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./data');

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const onChange = require('on-change');

const config = require("./config.json");

let osu_api;

function setItem (item, data) {
    localStorage.setItem(item, data);
}

function getItem (item) {
    return localStorage.getItem(item);
}

let database = {}

if(getItem("database")){
    database = JSON.parse(getItem("database"))
} else {
    setItem("database", JSON.stringify(database))
}

database = onChange(database, () => {
    setItem("database", JSON.stringify(database))
})

let active_stage = {}

if(getItem("active_stage")){
    active_stage = JSON.parse(getItem("active_stage"))
} else {
    setItem("active_stage", JSON.stringify(active_stage))
}

active_stage = onChange(active_stage, () => {
    setItem("active_stage", JSON.stringify(active_stage))
})

let commands = []

module.exports = {
    init(osu_api_key, cmds) {
        osu_api = axios.create({
            baseURL: 'https://osu.ppy.sh/api',
            params: {
                k: osu_api_key
            }
        });
        commands = cmds;
    },

    database,
    active_stage,

    download_file(url, file_path) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path.dirname(file_path))){
                fs.mkdirSync(path.dirname(file_path))
            }

            axios.get(url, {responseType: 'stream'}).then(response => {
                let stream = response.data.pipe(fs.createWriteStream(file_path));

                stream.on('finish', () => {
                    resolve();
                });
                stream.on('error', () => {
                    reject("Couldn't download file");
                });
            }).catch(() => {
                reject("Couldn't download file");
            });
        });

    },

    parse_beatmap_url: function(beatmap_url){
        if(beatmap_url.startsWith('<') && beatmap_url.endsWith('>'))
            beatmap_url = beatmap_url.substring(1, beatmap_url.length - 1);

        let beatmap_id = false;

        if(beatmap_url.includes("#osu/"))
            beatmap_id = parseInt(beatmap_url.split("#osu/").pop());
        else if(beatmap_url.includes("/b/"))
            beatmap_id = parseInt(beatmap_url.split("/b/").pop());
        else if(beatmap_url.includes("/osu/"))
            beatmap_id = parseInt(beatmap_url.split("/osu/").pop());
        else if(beatmap_url.includes("/beatmaps/"))
            beatmap_id = parseInt(beatmap_url.split("/beatmaps/").pop());
        else if(parseInt(beatmap_url) === beatmap_url)
            beatmap_id = parseInt(beatmap_url);

        return beatmap_id;
    },

    add_score(msg, data) {
        return new Promise((resolve, reject) => {
            if(active_stage.hasOwnProperty(msg.guild.id)) {
                let guild_stage = active_stage[msg.guild.id];
                let mapIndex = database[msg.guild.id][guild_stage[0]][guild_stage[1]]
                    .findIndex(m => m["id"] === data.id);

                if (mapIndex > -1) {
                    database[msg.guild.id][guild_stage[0]][guild_stage[1]][mapIndex]["scores"]
                        .push({
                            player: data.player,
                            date: data.date,
                            score: data.score
                        });
                    resolve();
                }
                else {
                    reject("Map is not found in database.")
                }
            } else reject("Please set an active stage.")

        })
    },

    parse_replay(path){
      return require('osureplayparser').parseReplay(path)
    },

    get_beatmap(req) {
        return osu_api.get("/get_beatmaps", { params: req })
    },

    get_all_commands() {
        let description = "";
        commands.forEach(cmd => {
            description += `\n**${cmd.command.map((a => { return config.prefix + a })).join(", ")}** ► ${cmd.description.split('\n')[0]}`
        })
        return {
            color: config.accent_color,
            title: "List of all available commands",
            description
        }
    },

    get_command_embed(cmd){
        return new Promise((resolve, reject) => {
            let command = commands.find(c => c.command.includes(cmd));
            if (command) {
                let fields = []
                fields.push({
                    name: "Commands",
                    value: "```" + command.command.map((a => { return config.prefix + a })).join(", ") + "```"
                })
                fields.push({
                    name: "Description",
                    value: command.description
                })
                fields.push({
                    name: "Usage",
                    value: "```" + config.prefix + command.command[0] + " " + command.usage + "```"
                })
                resolve({
                    color: config.accent_color,
                    fields
                })
            }
            else
                reject("Could not match any command.")
        })
    }
}