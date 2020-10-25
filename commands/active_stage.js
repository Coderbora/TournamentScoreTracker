module.exports = {
    command: ["activestage"],
    requiredPerms: ["MANAGE_GUILD"],
    call: obj => {
        return new Promise((resolve, reject) => {
            let {argv, msg, helper} = obj;

            let tournament = argv[1];
            let stage = argv[2];

            if (tournament && stage) {
                if(!module.exports.requiredPerms.some(perm => msg.member.hasPermission(perm)))
                    reject(`You must have ${module.exports.requiredPerms} perm to active stage.`)

                if(helper.database[msg.guild.id].hasOwnProperty(tournament)
                    && helper.database[msg.guild.id][tournament].hasOwnProperty(stage)) {
                    helper.active_stage[msg.guild.id] = [tournament, stage];
                    resolve(`Successfully set the active stage ${stage}/${tournament}.`)
                } else {
                    reject(`Cannot find the ${stage}/${tournament}.`)
                }
            } else if (!tournament && !stage) {
                let guild_stage = helper.active_stage[msg.guild.id];
                if (guild_stage)
                    resolve(`Currently active stage is ${guild_stage[1]}/${guild_stage[0]}.`)
                else
                    reject(`There is no currently active stage.`)
            } else {
                reject(`Please specify tournament and stage properly.`)
            }
        })
    }
}