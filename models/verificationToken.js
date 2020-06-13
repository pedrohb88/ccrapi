const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let schema = new mongoose.Schema( {
    phone: {
        type: String, 
        required: true,
    },
    code: {
        type: String,
        required: true,
    },
}, {timestamps: true});

schema.index({createdAt: 1}, {expireAfterSeconds: 900});

schema.methods.isValid = function(shouldDelete = true){
    return new Promise((resolve, reject) => {
        let token = this;
    
        VerificationToken.findOne({phone: token.phone})
        .then((t) => {
            if(!t){
                resolve(false);
                return;
            }

            let hashedCode = t.code;

            bcrypt.compare(token.code, hashedCode, (err, res) => {
                if(err) resolve(false);
                else{

                    if(res){
                        if(shouldDelete){
                            VerificationToken.deleteOne({phone: token.phone})
                            .then(() => {
                                resolve(true);
                            });
                        }
                        resolve(true);
                    } else resolve(false); 
                }
            });
        });
    });
}

let VerificationToken = mongoose.model('VerificationToken', schema);

module.exports = { VerificationToken };
