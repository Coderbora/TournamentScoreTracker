const path = require('path');
const fs = require('fs');

const config = require('./config.json');

const {DateTime} = require("luxon");
const Discord = require("discord.js");
const client = new Discord.Client();
const helper = require('./helper.js');
const ocr = require('./ocr.js');

if(config.aws_parameters)
    ocr.init(config.aws_parameters);
else
    ocr.init()

let commands = [];
const commandsDir = path.resolve(__dirname, 'commands');

fs.readdir(commandsDir, (err, items) => {
    if (err)
        throw "Unable to read commands folder";

    items.forEach(item => {
        if (path.extname(item) === '.js') {
            let command = require(path.resolve(commandsDir, item));
            if (!Array.isArray(command.command))
                command.command = [command.command]
            commands.push(command);
        }
    });
});

function checkCommand(msg) {
    if (!msg.content.startsWith(config.prefix))
        return false;

    if (msg.author.bot)
        return false;

    const regex = new RegExp('"[^"]+"|[\\S]+', 'g');
    const argv = [];
    msg.content.match(regex).forEach(element => {
        if (!element) return;
        return argv.push(element.replace(/"/g, ''));
    });
    argv[0] = argv[0].substr(config.prefix.length);

    let command = commands.find(c => c.command.includes(argv[0]))

    if (command) {
        if (command.call && typeof command.call === 'function') {
            let promise = command.call({
                msg,
                argv,
                client,
                ocr,
                config,
                helper
            });

            Promise.resolve(promise).then(response => {
                if (response) {
                    let message_promise, edit_promise, reaction, replace_promise, page;

                    if (typeof response === 'object' && 'edit_promise' in response) {
                        ({edit_promise} = response);
                        delete response.edit_promise;
                    }

                    if (typeof response === 'object' && 'replace_promise' in response) {
                        ({replace_promise} = response);
                        delete response.replace_promise;
                    }

                    if (typeof response === 'object' && 'reaction' in response) {
                        ({reaction} = response);
                        delete response.reaction;
                    }

                    if (typeof response === 'object' && 'page' in response) {
                        ({page} = response);
                        delete response.page;
                    }

                    message_promise = msg.channel.send(response);

                    message_promise.catch(err => {
                        msg.channel.send(`Couldn't run command: \`${err}\``);
                    });


                    Promise.all([message_promise, edit_promise, replace_promise]).then(responses => {
                        let message = responses[0];
                        let edit_promise = responses[1];
                        let replace_promise = responses[2];

                        if (edit_promise)
                            message.edit(edit_promise).catch(console.error);

                        if (replace_promise) {
                            msg.channel.send(replace_promise)
                                .catch(err => {
                                    msg.channel.send(`Couldn't run command: \`${err}\``);
                                }).finally(() => {
                                message.delete();
                            });
                        }

                        if (reaction) {
                            let reaction_array = reaction.reactions;
                            let reactions = reaction_array.map(a => a.emoji);

                            const filter = (reaction, user) => {
                                return reactions.includes(reaction.emoji.name) && user.id === msg.author.id;
                            };

                            reactions.forEach(async reaction => {
                                await message.react(reaction)
                            })

                            message.awaitReactions(filter, {max: 1, time: 60000, errors: ['time']})
                                .then(collected => {
                                    const reaction = collected.first();
                                    Promise.resolve(reaction_array.find(r => r.emoji === reaction.emoji.name).call())
                                        .then(obj => {
                                            if (typeof obj === 'object' && 'edit_promise' in obj)
                                                message.edit(obj.edit_promise).catch(console.error);

                                            message.reactions.removeAll()
                                        })
                                })
                                .catch(() => {
                                    Promise.resolve(reaction.timeout()).then(obj => {
                                        if (typeof obj === 'object' && 'edit_promise' in obj)
                                            message.edit(obj.edit_promise).catch(console.error);

                                        message.reactions.removeAll()
                                    })
                                });
                        }

                        if (page) {
                            message.react('⬅️').then(() => message.react('➡️'))
                            const collector = message.createReactionCollector(
                                (reaction, user) => ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === msg.author.id,
                                {time: 60000}
                            )
                            collector.on('collect', reaction => {
                                message.reactions.removeAll().then(() => {
                                    message.edit(reaction.emoji.name === '⬅️' ? page.back() : page.fwd())
                                    message.react('⬅️').then(() => message.react('➡️'))
                                })
                            })
                            collector.on('end', () => message.reactions.removeAll());

                        }
                    }).catch(err => {
                        msg.channel.send(`Couldn't run command: \`${err}\``);
                    });
                }
            }).catch(err => {
                if (typeof err === 'object')
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

    if (config.debug)
        console.log(`[${DateTime.local().toUTC()}] ${msg.author.tag} : ${msg.content}`)
});

client.on("ready", () => {
    helper.init(config.osu_api_key, commands);
    console.log(`Logged in as ${client.user.tag}!`);

});

client.login(config.token);
