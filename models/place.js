const mongoose = require('mongoose');
const _ = require('lodash');

let { Rating } = require('./rating');

let schema = new mongoose.Schema({

    place_id: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    prevencao: { type: Number },
    preco: { type: Number },
    servico: { type: Number },
    espera: { type: Number },
    seguranca: { type: Number },
    segurancaFeminina: { type: Number }
});

schema.statics.findById = function (place_id) {
    let Place = this;

    return Place.findOne({
        place_id: place_id
    });
}

schema.methods.hasUserRating = async function (userId) {
    let place = this;
    return new Promise((resolve, reject) => {
        Rating.findOne({
            userId,
            place_id: place['place_id'],
        }).then((place) => {

            if(place) resolve(true);
            else resolve(false);
        });
    });
}

schema.methods.recalculateRating = function () {
    let place = this;

    return new Promise((resolve, reject) => {
        Rating.find({place_id: place['place_id']})
        .then((ratings) => {

            let prevencao = 0, preco = 0, servico = 0, espera = 0, seguranca = 0, segurancaFeminina = 0;
            
            for(i = 0; i < ratings.length; i++){
                let rating = ratings[i];
                prevencao += rating.prevencao;
                preco += rating.preco;
                servico += rating.servico;
                espera += rating.espera;
                seguranca += rating.seguranca;
                segurancaFeminina += rating.segurancaFeminina;
            }

            place.prevencao = prevencao/ratings.length;
            place.preco = preco/ratings.length;
            place.servico = servico/ratings.length;
            place.espera = espera/ratings.length;
            place.seguranca = seguranca/ratings.length;
            place.segurancaFeminina = segurancaFeminina/ratings.length;

            place.save().then((p) => {
                resolve();
            });
        });
    });
}

let Place = mongoose.model('Place', schema);

module.exports = { Place };
