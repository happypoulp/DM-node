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
    this.grants_updated = true;

    this.get_expires_at = function(expires_in)
    {
        if (expires_in)
        {
            var currentDate = new Date();
            currentDate.setTime(parseInt(expires_in));
            return currentDate.toString();
        }

        return null;
    };

    this.set_grants_from_request = function(request)
    {
        this.set_access_token(request.getCookie('at'))
            .set_refresh_token(request.getCookie('rt'))
            .set_expires_in(request.getCookie('ei'));

        return this;
    };

    this.get_grants = function()
    {
        return {
            access_token: this.access_token,
            refresh_token: this.refresh_token,
            expires_at: this.get_expires_at(this.expires_in)
        };
    };

    this.get_grants_from_request = function(request)
    {
        return {
            access_token: request.getCookie("at"),
            refresh_token: request.getCookie("rt"),
            expires_at: this.get_expires_at(request.getCookie('ei'))
        };
    };

    this.update_grants = function(grants, response)
    {
        if (!grants)
        {
            return;
        }

        console.log(grants);

        if (grants)
        {
            if (grants.access_token)
            {
                this.set_access_token(grants.access_token);
                response && response.setCookie("at", grants.access_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
            }
            if (grants.refresh_token)
            {
                this.set_refresh_token(grants.refresh_token);
                response && response.setCookie("rt", grants.refresh_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
            }
            if (grants.expires_in)
            {
                this.set_expires_in(grants.expires_in);
                response && response.setCookie("ei", new Date().getTime() + grants.expires_in*1000, {expires: new Date().getTime() + (1000*60*60*24*365)});
            }
        }
    };

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
                        this.grants_updated = true;

                        this.set_access_token(JSONResponse.access_token);
                        this.set_refresh_token(JSONResponse.refresh_token);
                        this.set_expires_in(JSONResponse.expires_in);

                        callback();
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
        this.grants_updated = false;

        return this._call(call, callback);
    }

    this._call = function(call, callback)
    {
        console.log(JSON.stringify(call));
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
                        console.log('### TOKEN EXPIRED ### - trying to refresh it');
                        this.refresh_access_token(this.refresh_token, function()
                        {
                            console.log('Replay api request...');
                            method_call.apply(this, method_args);
                        }.bind(this));
                    }
                    /**
                     *
                     * CALL API SUCCEEDED, PRINTING RESPONSE
                     *
                    **/
                    else
                    {
                        var grants = null;

                        if (this.grants_updated)
                        {
                            grants = {
                                access_token: this.access_token,
                                refresh_token: this.refresh_token,
                                expires_in: this.expires_in
                            }
                        }
                        callback(JSONResponse, grants);
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

        return req;
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
