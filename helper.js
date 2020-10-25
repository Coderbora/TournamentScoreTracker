const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./data');

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const onChange = require('on-change');

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

module.exports = {
    init(osu_api_key) {
        osu_api = axios.create({
            baseURL: 'https://osu.ppy.sh/api',
            params: {
                k: osu_api_key
            }
        });
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

    string_similarity(a, b) {
        let equivalency = 0;
        let minLength = (a.length > b.length) ? b.length : a.length;
        let maxLength = (a.length < b.length) ? b.length : a.length;
        for(let i = 0; i < minLength; i++) {
            if(a[i] === b[i]) {
                equivalency++;
            }
        }

        return equivalency / maxLength;
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
    }
}