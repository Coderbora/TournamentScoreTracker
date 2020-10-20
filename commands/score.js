const requestImageSize = require('request-image-size')

const default_settings = {
    dimensions: [1366, 768],
    map_player_info: {
        left: 1,
        top: 1,
        width: 900,
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
    command: ["score", "sc"],
    call: obj => {
        return new Promise(async (resolve, reject) => {
            let { msg, infoscheduler, digitscheduler } = obj;
            if (msg.attachments.size > 0) {
                let attachment = msg.attachments.first();
                if (attachment.name.match(/[^/]+(jpg|jpeg|png)$/)) {
                    let dimensions = await requestImageSize(attachment.url);
                    let settings = buildSettings(dimensions.width, dimensions.height);

                    let data = {
                        title: "",
                        score: ""
                    }

                    let jobs = [
                        infoscheduler.addJob('recognize', attachment.url, { rectangle: settings.map_player_info }),
                        digitscheduler.addJob('recognize', attachment.url, { rectangle: settings.score })
                    ]
                    Promise.all(jobs).then(results => {
                        data.title = results[0].data.text;
                        console.log(results[1].data.text)
                        data.score = results[1].data.text.length > 7 ?
                            Number(results[1].data.text.substring(results[1].data.text.length - 8)) :
                            Number(results[1].data.text);

                        resolve (`${data.title}  -  ${data.score}`)
                    }).catch(err => reject(err))
                }
            }
        })
    }
}