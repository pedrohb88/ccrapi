const mongoose = require('mongoose');
const validator = require('validator');

let { VerificationToken } = require('./verificationToken');
const cryptoRandomString = require('crypto-random-string');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const _ = require('lodash');

let userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        minlength: 1,
        validate: {
            validator: function(v){
                return validator.isMobilePhone(v, 'pt-BR');
            },
            message: '{VALUE} não é um telefone válido',
        }
    },
    tokens: [{
        access: {
            type: String,
            minlength: 1,
        },
        token: {
            type: String,
            minlength: 1
        }
    }]
});


userSchema.methods.toJSON = function () {
    let user = this;
    let userObject = user.toObject();

    return _.pick(userObject, ['_id', 'name', 'phone', 'options']);
};


userSchema.statics.sendVerificationToken = function (phone) {

    return new Promise((resolve, reject) => {

        VerificationToken.deleteMany({ phone: phone }).then(() => {
            let code = cryptoRandomString({ length: 4 });

            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(code, salt, (err, hash) => {
                    let token = new VerificationToken({ phone, code: hash });

                    token.save();
                
                    const accountSid = process.env.TWILIO_ACCOUNT_SID;
                    const authToken = process.env.TWILIO_AUTH_TOKEN;
                    const client = require('twilio')(accountSid, authToken);

                    client.messages
                    .create({
                        body: `Seu código ParadaSegura é ${code}`,
                        from: 'whatsapp:+14155238886',
                        to: `whatsapp:${phone}`
                    })
                    .then(message => {
                        console.log(message.sid);
                        resolve({
                            success: true,
                            error: null
                        });
                    }).catch((e) => {
                        console.log(e);
                        resolve({success: false, error: e});
                    });
                });
            });
        });
    });
}

userSchema.methods.generateAuthToken = function () {
    let user = this;
    let access = 'auth';
    let token = jwt.sign({
        _id: user._id.toHexString(),
        access
    }, process.env.JWT_SECRET).toString();

    user.tokens = user.tokens.concat({ access, token });

    //when returning from a then call, it returns a Promise. When returning a value from a then call, it returns a Promise with the value as a param to the next then call
    return user.save().then(() => {
        return token;
    });
};

userSchema.methods.removeToken = function (tokenToRemove) {
    let user = this;

    return User.updateOne({
        _id: user._id
    }, {
        $pull: {
            tokens: {
                token: tokenToRemove
            }
        }
    });
};

userSchema.statics.findByToken = function (token) {
    let User = this; //the model itself, not the instance
    let decoded;

    //if then token wasn't changed, then the token object is returned
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        /*return new Promise((resolve, reject) => {
            reject();
        });*/
        //same as
        return Promise.reject(e);
    }

    //returns a Promise with the user as param
    //find the user who matches the id stored in the token, and the user who has this token on the token array
    return User.findOne({
        _id: decoded._id,
        //the token could have been deleted from the database before the request, so it's necessary to check for the token itself.
        'tokens.token': token,
        'tokens.access': 'auth'
    });
};

userSchema.statics.findByPhone = function (phone) {
    let User = this;

    return User.findOne({
        phone: phone
    });
}

userSchema.statics.isRegistered = function (phone) {
    return new Promise((resolve, reject) => {
        let User = this;

        User.findOne({ phone: phone }).then((user) => {

            if (user) {
                resolve(true);
                return;
            }
            resolve(false);
        });
    })
}

let User = mongoose.model('User', userSchema);

module.exports = { User };
