var http = require("http"),
    https = require("https"),
    querystring = require("querystring"),
    util = require("util");

var DM = function()
{
    this.domain = 'api.dailymotion.com';
    this.protocol = 'https';
    this.port = 443;
    this.http_mod = https;

    this.set_access_token = function(access_token)
    {
        this.access_token = access_token;
        return this;
    };

    this.set_refresh_token = function(refresh_token)
    {
        this.refresh_token = refresh_token;
        return this;
    };

    this.set_expires_in = function(expires_in)
    {
        this.expires_in = expires_in;
        return this;
    };

    this.get_authorize_url = function(redirect_uri, scopes)
    {
        this.authorization_redirect_uri = redirect_uri;

        return this.protocol + '://' + this.domain +
            '/oauth/authorize?response_type=code&client_id=' + this.client_id +
            '&redirect_uri=' + encodeURIComponent(redirect_uri) +
            '&scope=' + scopes.join('+');
    };

    this.get_access_token = function(authorize_response, callback)
    {
        var query = {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                redirect_uri: this.authorization_redirect_uri,
                code: authorize_response.code
            },
            postData = querystring.stringify(query),
            options = {
                hostname: this.domain,
                port: this.port,
                path: '/oauth/token',
                headers: {
                    'host': this.domain,
                    'Content-Length': Buffer.byteLength(postData, 'utf8'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST'
            },
            req = this.http_mod.request(options, function(res)
            {
                var responseBody = "";

                res.setEncoding('utf8');

                res.on("data", function(chunk)
                {
                    console.log('BODY: ' + chunk);
                    responseBody += chunk;
                });

                res.on("end", function()
                {
                    callback(JSON.parse(responseBody));
                });

            });

        req.on('error', function(e)
        {
            console.log('problem with request: ' + e.message);
        });

        // write data to request body
        req.write(postData);
        req.end();
    };

    this.refresh_access_token = function(refresh_token, callback)
    {
        if (refresh_token)
        {
            var call = {
                    grant_type: 'refresh_token',
                    client_id: this.client_id,
                    client_secret: this.client_secret,
                    refresh_token: refresh_token
                },
                postData = querystring.stringify(call);

            console.log('postData : ');
            console.log(postData);

            var options = {
                    hostname: this.domain,
                    port: this.port,
                    path: '/oauth/token',
                    headers: {
                        'host': this.domain,
                        'Content-Length': Buffer.byteLength(postData, 'utf8'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    method: 'POST'
                },
                req = this.http_mod.request(options, function(res)
                {
                    var response = "";
                    res.setEncoding("utf8");
            
                    res.on("data", function(chunk)
                    {
                        response += chunk;
                    });
            
                    res.on("end", function()
                    {
                        JSONResponse = JSON.parse(response);
            
                        console.log('response', response);
                        console.log('JSONResponse', JSONResponse);

                        callback(JSONResponse);
                    }.bind(this));
                }.bind(this));

            req.on('error', function(e)
            {
                console.log('problem with request: ' + e.message);
            });

            req.write(postData);
            req.end();
        }
    };

    this.call = function(call, callback)
    {
        var postData = JSON.stringify(call),
            method_call = arguments.callee,
            method_args = arguments,
            options = {
                hostname: this.domain,
                port: (this.protocol == 'https' ? 443 : 80),
                path: '/json',
                headers: {
                    'host': this.domain,
                    'Content-Length': Buffer.byteLength(postData, 'utf8'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'OAuth ' + this.access_token
                },
                method: 'POST'
            },
            req = this.http_mod.request(options, function(res)
            {
                var responseBody = "";

                console.log('STATUS: ' + res.statusCode);
                console.log('HEADERS: ' + JSON.stringify(res.headers));

                res.setEncoding('utf8');

                res.on("data", function(chunk)
                {
                    console.log('BODY: ' + chunk);
                    responseBody += chunk;
                });

                res.on("end", function()
                {
                    JSONResponse = JSON.parse(responseBody);

                    console.log('JSONResponse');
                    console.log(JSONResponse);

                    /**
                     *
                     * ACCESS TOKEN EXPIRED, NEED TO GET A NEW ONE USING REFRESH TOKEN
                     *
                    **/
                    if (JSONResponse.error && res.headers['www-authenticate'].match(/error="(expired_token|invalid_token)"/))
                    {
                        console.log('ERROR', JSONResponse.error);
                        this.refresh_access_token(this.refresh_token, function()
                        {
                            console.log('Replay api request...');
                            method_call.apply(this, arguments);
                        }.bind(this));
                    }
                    /**
                     *
                     * CALL API SUCCEEDED, PRINTING RESPONSE
                     *
                    **/
                    else
                    {
                        callback(JSONResponse);
                    }
                }.bind(this));

            }.bind(this));

        req.on('error', function(e)
        {
            console.log('problem with request: ' + e.message);
        });

        // write data to request body
        req.write(postData);
        req.end();
    };

    this.init = function(options)
    {
        if (!options.client_id || !options.client_secret)
        {
            console.log('UNABLE TO INITIALIZE DM API MODULE : MISSING api_key or api_secret...');
            return;
        }

        this.client_id = options.client_id;
        this.client_secret = options.client_secret;

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
                this.http_mod = http;
            }
        }

        return this;
    };
}

module.exports.new = function()
{
    return new DM();
};
