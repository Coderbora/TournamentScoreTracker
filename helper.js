const axios = require('axios')
const fs = require('fs')
const path = require('path')

let osu_api;

module.exports = {
    init(osu_api_key) {
        osu_api = axios.create({
            baseURL: 'https://osu.ppy.sh/api',
            params: {
                k: osu_api_key
            }
        });
    },
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
    parse_replay(path){
      return require('osureplayparser').parseReplay(path)
    },
    get_beatmap(req) {
        return osu_api.get("/get_beatmaps", { params: req })
    }
}