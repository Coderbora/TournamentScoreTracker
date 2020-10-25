module.exports = {
    command: ["help"],
    description: "Get help for a command.",
    usage: "(command)",
    call: obj => {
        return new Promise((resolve, reject) => {
            let {argv, helper} = obj;
            if(argv[1]) {
                helper.get_command_embed(argv[1]).then(embed => {
                    resolve({embed})
                }).catch(err => reject(err))
            } else {
                resolve({embed:helper.get_all_commands()})
            }
        })
    }
}