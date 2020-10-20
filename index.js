const path = require('path');
const fs = require('fs');

const config = require('./config.json');

const { DateTime } = require("luxon");
const { createWorker, createScheduler } = require('tesseract.js');
const Discord = require("discord.js");
const client = new Discord.Client();

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
})();

let commands = [];
const commandsDir = path.resolve(__dirname, 'commands');

fs.readdir(commandsDir, (err, items) => {
    if(err)
        throw "Unable to read commands folder";

    items.forEach(item => {
        if(path.extname(item) === '.js'){
            let command = require(path.resolve(commandsDir, item));
            if (!Array.isArray(command.command))
                command.command = [command.command]
            commands.push(command);
        }
    });
});

function checkCommand(msg) {
    if(!msg.content.startsWith(config.prefix))
        return false;

    if(msg.author.bot)
        return false;

    let argv = msg.content.split(' ');
    argv[0] = argv[0].substr(config.prefix.length);

    let command = commands.find(c => c.command.includes(argv[0]))

    if(command) {
        if(command.call && typeof command.call === 'function'){
            let promise = command.call({
                msg,
                argv,
                client,
                infoscheduler,
                digitscheduler
            });

            Promise.resolve(promise).then(response => {
                if(response){
                    let message_promise, edit_promise, replace_promise;

                    if(typeof response === 'object' && 'edit_promise' in response){
                        ({edit_promise} = response);
                        delete response.edit_promise;
                    }

                    if(typeof response === 'object' && 'replace_promise' in response){
                        ({replace_promise} = response);
                        delete response.replace_promise;
                    }

                    message_promise = msg.channel.send(response);

                    message_promise.catch(err => {
                        msg.channel.send(`Couldn't run command: \`${err}\``);
                    });


                    Promise.all([message_promise, edit_promise, replace_promise]).then(responses => {
                        let message = responses[0];
                        let edit_promise = responses[1];
                        let replace_promise = responses[2];

                        if(edit_promise)
                            message.edit(edit_promise).catch(console.error);

                        if(replace_promise){
                            msg.channel.send(replace_promise)
                                .catch(err => {
                                    msg.channel.send(`Couldn't run command: \`${err}\``);
                                }).finally(() => {
                                message.delete();
                            });
                        }
                    }).catch(err => {
                        msg.channel.send(`Couldn't run command: \`${err}\``);
                    });
                }
            }).catch(err => {
                if(typeof err === 'object')
                    msg.channel.send(err);
                else
                    msg.channel.send(`Couldn't run command: \`${err}\``);

                console.error(err);
            });
        }
    }
}

client.on("message", msg => {
    checkCommand(msg)

    if(config.debug)
        console.log(`[${DateTime.local().toUTC()}] ${msg.author.tag} : ${msg.content}`)
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);

});

client.login(config.token);