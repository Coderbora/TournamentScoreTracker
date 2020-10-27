const {createWorker, createScheduler} = require('tesseract.js');
const AWS = require('aws-sdk')
const axios = require('axios')

let mode = "tesseract"
let tesseractSchedulers = {}
let rekognition;

module.exports = {
    init(aws) {
        if (aws) {
            mode = "aws"
            AWS.config.update(aws);
            rekognition = new AWS.Rekognition();
        } else {
            const infoworker = createWorker();
            const infoscheduler = createScheduler();
            const digitworker = createWorker();
            const digitscheduler = createScheduler();

            (async () => {
                await infoworker.load()
                await infoworker.loadLanguage('eng')
                await infoworker.initialize('eng');
                infoscheduler.addWorker(infoworker);

                await digitworker.load()
                await digitworker.loadLanguage('eng')
                await digitworker.initialize('eng');
                await digitworker.setParameters({
                    tessedit_char_whitelist: '0123456789',
                });
                digitscheduler.addWorker(digitworker);

                tesseractSchedulers = {
                    infoscheduler,
                    digitscheduler
                }
            })();
        }
    },

    detectText(image, type, rect, dimensions) {
        return new Promise((resolve, reject) => {
            if (mode === "aws") {
                axios.get(image, {responseType: 'arraybuffer'}).then(response => {
                    rekognition.detectText({
                        Filters: {
                          RegionsOfInterest: [
                              {
                                  BoundingBox: {
                                      Height: rect.height/dimensions[1],
                                      Left: rect.left/dimensions[0],
                                      Top: rect.top/dimensions[1],
                                      Width: rect.width/dimensions[0]
                                  }
                              }
                          ]
                        },
                        Image: {
                            Bytes: Buffer.from(response.data, 'base64')
                        }
                    }).promise().then(res => {
                        let text = res.TextDetections.filter(d => d.Type === "LINE")
                            .map(d => d.DetectedText).join("\n")
                        resolve(text)
                    });
                })
            } else {
                if (type === "text") {
                    tesseractSchedulers.infoscheduler.addJob('recognize', image, {rectangle: rect}).then(res => {
                        resolve(res.data.text)
                    })
                } else if (type === "digit") {
                    tesseractSchedulers.digitscheduler.addJob('recognize', image, {rectangle: rect}).then(res => {
                        resolve(res.data.text)
                    })
                } else {
                    reject("Please specify type correctly.")
                }
            }
        })
    }
}