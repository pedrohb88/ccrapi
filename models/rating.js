const mongoose = require('mongoose');
const _ = require('lodash');

let schema = new mongoose.Schema({

    userId: {
        type: mongoose.Types.ObjectId,
        required: true,
        trim: true,
        minlength: 1
    },
    place_id: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
    },
    prevencao: {type: Number, required: true, min: 0, max: 5},
    preco: {type: Number, required: true, min: 0, max: 5},
    servico: {type: Number, required: true, min: 0, max: 5},
    espera: {type: Number, required: true, min: 0, max: 5},
    seguranca: {type: Number, required: true, min: 0, max: 5},
    segurancaFeminina: {type: Number, required: true, min: 0, max: 5}
});


let Rating = mongoose.model('Rating', schema);

module.exports = { Rating };
