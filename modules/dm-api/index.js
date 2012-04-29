var http = require("http"),
    https = require("https"),
    util = require("util");

var DM = function()
{
    this.domain = 'api.dailymotion.com';
    this.protocol = 'https';
    this.port = 443;
    this.httpMod = https;

    this.getAuthorizeUrl = function(redirectUri, scopes)
    {
        return this.protocol + '://' + this.domain +
            '/oauth/authorize?response_type=code&client_id=' + this.key + '&redirect_uri=' + encodeUriComponent(redirectUri) + '&scope=' + scopes.join('+');
    };

    this.init = function(options)
    {
        if (!options.key || !options.secret)
        {
            console.log('UNABLE TO INITIALIZE DM API MODULE : MISSING api_key or api_secret...');
            return;
        }

        this.key = options.key;
        this.secret = options.secret;

        if (options.domain)
        {
            this.domain = options.domain;
        }
        if (options.protocol)
        {
            this.protocol = options.protocol;

            if (this.protocol == 'http')
            {
                this.port = 80;
                this.httpMod = http;
            }
        }

        return this;
    };
}

module.exports.new = function()
{
    return new DM();
};
