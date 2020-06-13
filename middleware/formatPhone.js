let formatPhone = function(req, res, next){

    if(req.params.phone != null)
        req.params.phone = `+55${req.params.phone}`;
    if(req.body.phone != null)
        req.body.phone = `+55${req.body.phone}`;
    next();
}

module.exports = {formatPhone};