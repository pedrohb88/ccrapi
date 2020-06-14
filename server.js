require('./config/config');
const {mongoose} = require('./db/mongoose');
const _ = require('lodash');
const uuid = require('uuid').v4;
const xmlparser = require('express-xml-bodyparser');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const webhooks = require('twilio/lib/webhooks/webhooks');
const axios = require('axios');

let {authenticate, authenticateServer} = require('./middleware/authenticate');
let {formatPhone} = require('./middleware/formatPhone');
let {User} = require('./models/user');
let {VerificationToken} = require('./models/verificationToken');
let {Place} = require('./models/place');
let {Rating} = require('./models/rating');

const express = require('express');
const cryptoRandomString = require('crypto-random-string');

let app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({extended: false}));


app.get('/user/verification_code/:phone', formatPhone, async (req, res) => {
    let phone = req.params.phone;
    
    let result = await User.sendVerificationToken(phone);
    result['alreadyRegistered'] = await User.isRegistered(phone);
    res.send(result);
});


app.post('/user', formatPhone, (req, res) => {
    let body = _.pick(req.body, ['name', 'phone']);
   
    let verificationToken = new VerificationToken({
        phone: body.phone,
        code: req.body.verificationCode,
    });

    User.findOne({phone: body.phone}).then(async (u) => {
        if(u){
            res.status(400).send({
                success: false,
                error: 'Telefone já cadastrado'
            })
            return;
        }

        let validCode = await verificationToken.isValid();
  
        if(validCode){
            let newUser = new User(body);

            newUser.save().then(async (user) => {

                if(user){
                    let token = await user.generateAuthToken();
                    res.header('x-auth', token).send({success: true, data: user});
                }else {
                    res.send({success: false})
                }
            }).catch((e) => {
                res.status(400).send(e);
            });

        
        }else{
            res.status(401).send('Código inválido');
        } 
    })
})

app.post('/user/login', formatPhone, (req, res) => {
    let body = _.pick(req.body, ['phone', 'verificationCode']);
   
    let verificationToken = new VerificationToken({
        phone: body.phone,
        code: req.body.verificationCode,
    });

    User.findOne({phone: body.phone}).then(async (user) => {

        if(!user){
            res.status(401).send('Telefone inválido');
            return;
        }
        
        let validCode = await verificationToken.isValid();
  
        if(validCode){
           
            user.generateAuthToken().then((token) => {
                res.header('x-auth', token).send(user);
            });
        }else{
            res.status(401).send('Código inválido');
        } 
    })
});

app.get('/user', authenticate, (req, res) => {

    User.findByToken(req.header('x-auth')).then((user) => {

        if(!user) res.status(401).send();
        else {

            res.send(user);
        }
    }).catch((e) => {
        console.log(e);
        res.status(400).send(e);
    });
});

app.post('/user/verifyCode', formatPhone, async (req, res) => {
    let body = _.pick(req.body, ['phone', 'verificationCode']);
   
    let verificationToken = new VerificationToken({
        phone: body.phone,
        code: req.body.verificationCode,
    });

    let validCode = await verificationToken.isValid(false);
    if(validCode) res.status(200).send();
    else res.status(401).send();
})

app.get('/place/:id', authenticate, (req, res) => {
    let placeId = req.params.id;

    Place.findById(placeId).then((place) => {
        if(!place) res.status(400).send();
        else  res.send(place);
        
    }).catch((e) => {
        console.log(e);
        res.status(400).send(e);
    });
})

app.post('/place/:id/rating', authenticate, async (req, res) => {
    let placeId = req.params.id;

    Place.findById(placeId).then(async (place) => {

        if(!place){
            let newPlace = new Place({
                place_id: placeId,
            });

            await newPlace.save();
            place = newPlace;
        } 
        
        let hasRatingAlready = await place.hasUserRating(req.user._id);

        if(!hasRatingAlready){
            let newRating = Rating({
                userId: req.user._id,
                place_id: placeId,
                ...req.body
            });
            await newRating.save();

            await place.recalculateRating();

            res.send();
            return;
        }

        res.status(400).send();

    }).catch((e) => {
        console.log(e);
        res.status(400).send(e);
    });
});


app.listen(port, () => {
    console.log(`server running on port ${port}`);
});