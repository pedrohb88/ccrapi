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


let userStates = {};

const comandos = [
    {label: '1', text: '1. Ver lista de paradas próximas'},
    {label: '2', text: '2. Ver lista de números de emergência'},
    {label: '3', text: '3. Ver informações sobre direito dos caminhoneiros'},
    {label: '4', text: '4. Ver informações sobre prevenção ao Coronavírus'},
];

let comandosString = function(){
    let str = '';
    comandos.forEach((comando) => {
        str += `- ${comando.text}\n`;
    });
    return str;
}

app.post('/message', (req, res) => {

    let url = 'https' + '://' + req.get('host') + req.originalUrl;
    let params = req.body;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    let signature = webhooks.getExpectedTwilioSignature(authToken, url, params);
    let twilioSignature = req.headers['x-twilio-signature'];
   
    if(signature === twilioSignature) {

        const apiUrl = process.env['API_URL'];
        
        let phone = params.From.split(':')[1];
        console.log(userStates[phone]);

        if(userStates[phone] == null){
            
            userStates[phone] = 'waitingName';
            let response = new MessagingResponse();
            response.message('Olá! Sou o Bot ParadaSegura, e tô aqui pra deixar sua vida na estrada mais tranquila.');
            response.message('Como você se chama?');
            res.send(response.toString());
        } else if(userStates[phone] == 'waitingName'){

            userStates[phone] = 'logged';
            let name = params.Body.trim();


            let response = new MessagingResponse();
            response.message(`É um prazer te conhecer, ${name} :)`);

            let comandos = comandosString();
            response.message(`Para começar a usar, digite o *número* de um dos seguintes comandos:\n\n${comandos}\n\nA qualquer momento você pode digitar *ajuda* para ver a lista de comandos novamente.`);
            res.send(response.toString());
        } else if(userStates[phone] == 'logged'){

            let comando = params.Body.trim();

            if(comando == '1'){

                let response = new MessagingResponse();
                response.message('Paradas mais próximas');
                res.send(response.toString());

            } else if(comando == '2'){
                let response = new MessagingResponse();
                response.message(`Números de emergência:\n\n- Corpo de Bombeiros: 193\n- Policia Militar: 190\n- Polícia Rodoviária Federal: 191\n- Polícia Rodoviária Estadual: 198\n- Defesa Civíl: 199\n- SAMU: 192\n- Central de Atendimento à Mulher: 180`);
                res.send(response.toString());

            } else if(comando == '3'){

                let response = new MessagingResponse();
                response.message('Direito dos caminhoneiros');
                res.send(response.toString());

            }else if(comando == '4'){

                let response = new MessagingResponse();
                response.message('Coronavirus');
                res.send(response.toString());
            } else if(comando.toLowerCase() == 'ajuda'){

                let response = new MessagingResponse();
                let comandos = comandosString();
                response.message(`Digite o *número* de um dos seguintes comandos:\n\n${comandos}\n\nA qualquer momento você pode digitar *ajuda* para ver a lista de comandos novamente.`);
                res.send(response.toString());
            } 
            else {

                let response = new MessagingResponse();
                response.message('Não entendi seu comando :( Digite *ajuda* para ver a lista de comandos.');
                res.send(response.toString());
            }
        }
        
    }else {
        console.log('assinatura incorreta');
        res.status(401).send('assinatura incorreta');
    }

});

//envia o código de verificação para o email do usuário
app.get('/bot/user/verification_code/:email', authenticateServer, async (req, res) => {
    let email = req.params.email;
    
    let result = await User.sendVerificationToken(email);
    res.send(result);
});

//verifica o código de verificação e cadastra o usuário
app.post('/bot/user', authenticateServer, (req, res) => {
    let body = _.pick(req.body, ['name', 'email', 'phone']);
   
    let verificationToken = new VerificationToken({
        email: body.email,
        code: req.body.verificationCode,
    });

    User.findOne({email: body.email}).then(async (u) => {
        if(u){
            res.status(400).send({
                success: false,
                error: 'Email já cadastrado'
            })
            return;
        }

        let validCode = await verificationToken.isValid();
  
        if(validCode){
            let defaultXp = 0;

            body['experience'] = defaultXp;
            body['totalBalance'] = req.body.totalBalance ? req.body.totalBalance : 0.0;

            body['options'] = await Profile.getOptionsByXp(defaultXp);

            let newUser = new User(body);
            newUser.save().then((user) => {
                res.send({
                    success: true,
                    data: user
                });
            }).catch((e) => {
                res.status(400).send(e);
            });

        
        }else{
            res.status(401).send('Código inválido');
        } 
    })
});


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