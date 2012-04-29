/*************************************************
 *
 * ADVANCED SERVER DEMO by Classtar,
 * 
 * Based on NodeJS (http://nodejs.org/api/)
 * Based on Swig (https://github.com/paularmstrong/swig/tree/master/docs#readme)
 *
**************************************************/


/*************************************************
 *
 * GLOBAL CONFIGURATION
 *
**************************************************/
var root = process.cwd(); 

if (process.argv.length <= 2 || !process.argv[2].match(/key=|secret=/) || !process.argv[3].match(/key=|secret=/))
{
    return console.log('Usage: node serverDemo.js key=<api_key> secret=<api_secret>');
}

var key = process.argv[2].match(/key=/) ? process.argv[2].replace(/key=/, '') : process.argv[3].replace(/secret=/, ''),
    secret = process.argv[3].match(/key=/) ? process.argv[3].replace(/key=/, '') : process.argv[3].replace(/secret=/, '');

global.CONF = {
    serverHost: '127.0.0.1',
    serverPort: 8000,
    templateRoot: root + '/templates/',
    staticRoot: root,

    api_protocol: 'https',
    api_domain: 'api.dailymotion.com',
    api_key: key,
    api_secret: secret,
};

CONF.serverURL = CONF.serverHost + ':' + CONF.serverPort;

var cookie = require("./modules/cookie-node"),
    querystring = require("querystring"),
    http = require("http"),
    https = require("https"),
    NjServer = require("./modules/ninja"), // My custom server
    DM = require("./modules/dm-api"); // My custom server

/*************************************************
 *
 * ALL ROUTES - MAPPING BETWEEN "URI" AND CORRESPONDING "CONTROLLER NAME"
 *
**************************************************/
var ROUTES = {
    '/': 'index',
    '/reset': 'reset',
    '/oauth_success': 'oauth_success',
    '/get_access_token': 'get_access_token',
    '/api_action': 'api_action'
};


var baseDatas = {
    api_protocol: CONF.api_protocol,
    api_domain: CONF.api_domain,
    api_key: CONF.api_key,
    serverURL: CONF.serverURL,
    actions: {
        testecho: {
            call: 'test.echo',
            args: '{"message":"This is a useless message..."}'
        },
        videolist: {
            call: 'video.list',
            args: '{"localization":"detect","fields": ["id", "title"],"channel":"tv"}'
        },
        videoinfo: {
            call: 'video.info',
            args: '{"id":"xf3tgr", "fields": ["title", "description", "url", "duration", "thumbnail_large_url"]}'
        },
        videoedit: {
            call: 'video.edit',
            args: '{"id":"xf3tgr", "title": "tranquilize edtited"}'
        }
    }
};

/*************************************************
 *
 * CONTROLLER HANDLERS - MAPPING BETWEEN "CONTROLLER NAME" AND CORRESPONDING "CONTROLLER FUNCTION"
 *
**************************************************/
var CONTROLLERS = {
    index : function(request, response)
    {
        var datas = baseDatas;

        datas.access_token = request.getCookie("at");
        datas.refresh_token = request.getCookie("rt");

        response.emit('render', {
            'status': 200,
            'template': 'index.html',
            'datas': datas
        });
    },
    reset : function(request, response)
    {
        var datas = baseDatas;

        response.clearCookie('at');
        response.clearCookie('rt');

        response.emit('render', {
            'status': 200,
            'template': 'index.html',
            'datas': datas
        });
    },
    oauth_success : function(request, response)
    {
        var datas = baseDatas;

        if (request.GETS.code)
        {
            // console.log(request.GETS.code);
            datas.code_access_token = request.GETS.code;
            datas.access_token_query_params = querystring.stringify(request.GETS);
        }

        response.emit('render', {
            'status': 200,
            'template': 'index.html',
            'datas': datas
        });
    },
    get_access_token : function(request, response)
    {
        var datas = baseDatas,
            httpModule = (CONF.api_protocol == 'https' ? https : http),
            query = {
                grant_type: 'authorization_code',
                client_id: CONF.api_key,
                client_secret: CONF.api_secret,
                redirect_uri: 'http://' + CONF.serverURL + '/oauth_success',
                code: request.GETS.code
            },
            postData = querystring.stringify(query),
            options = {
                hostname: CONF.api_domain,
                port: (CONF.api_protocol == 'https' ? 443 : 80),
                path: '/oauth/token',
                headers: {
                    'host': CONF.api_domain,
                    'Content-Length': Buffer.byteLength(postData, 'utf8'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST'
            },
            req = httpModule.request(options, function(res)
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

                    console.log(JSONResponse);

                    datas.access_token = JSONResponse.access_token;
                    datas.refresh_token = JSONResponse.refresh_token;

                    response.setCookie("at", JSONResponse.access_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
                    response.setCookie("rt", JSONResponse.refresh_token, {expires: new Date().getTime() + (1000*60*60*24*365)});

                    console.log('datas');
                    console.log(datas);

                    response.emit('render', {
                        'status': 200,
                        'template': 'index.html',
                        'datas': datas
                    });
                });

            });

        req.on('error', function(e)
        {
            console.log('problem with request: ' + e.message);
        });

        // write data to request body
        req.write(postData);
        req.end();
    },
    api_action: function(request, response)
    {
        var datas = baseDatas;

        if (request.GETS.call)
        {
            datas.call = request.GETS.call;

            var httpModule = (CONF.api_protocol == 'https' ? https : http),
                query = {
                    'call': request.GETS.call,
                    'args': JSON.parse(request.GETS.args)
                },
                postData = JSON.stringify(query),
                options = {
                    hostname: CONF.api_domain,
                    port: (CONF.api_protocol == 'https' ? 443 : 80),
                    path: '/json',
                    headers: {
                        'host': CONF.api_domain,
                        'Content-Length': Buffer.byteLength(postData, 'utf8'),
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'OAuth ' + request.getCookie('at')
                    },
                    method: 'POST'
                },
                req = httpModule.request(options, function(res)
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

                        console.log(JSONResponse);

                        datas.access_token = request.getCookie("at");
                        datas.refresh_token = request.getCookie("rt");

                        console.log('datas');
                        console.log(datas);

                        /**
                         *
                         * ACCESS TOKEN EXPIRED, NEED TO GET A NEW ONE USING REFRESH TOKEN
                         *
                        **/

                        if (JSONResponse.error && res.headers['www-authenticate'].match(/error="(expired_token|invalid_token)"/))
                        {
                            console.log('NEED TO REFRESH ACCESS TOKEN');
                            needAccessTokenRefresh = false;

                            var refresh_call = {
                                    grant_type: 'refresh_token',
                                    client_id: CONF.api_key,
                                    client_secret: CONF.api_secret,
                                    refresh_token: datas.refresh_token
                                },
                                refreshPostData = JSON.stringify(refresh_call);

                            console.log('refreshPostData : ');
                            console.log(refreshPostData);

                            var refreshOptions = {
                                    hostname: CONF.api_domain,
                                    port: (CONF.api_protocol == 'https' ? 443 : 80),
                                    path: '/oauth/token',
                                    headers: {
                                        'host': CONF.api_domain,
                                        'Content-Length': Buffer.byteLength(refreshPostData, 'utf8'),
                                        'Content-Type': 'application/x-www-form-urlencoded'
                                        // 'Authorization': 'OAuth ' + request.getCookie('at')
                                    },
                                    method: 'POST'
                                },
                                refreshReq = httpModule.request(refreshOptions, function(refreshRes)
                                {
                                    var refreshResponse = "";
                                    refreshRes.setEncoding("utf8");
                            
                                    refreshRes.on("data", function(chunk)
                                    {
                                        refreshResponse += chunk;
                                    });
                            
                                    refreshRes.on("end", function()
                                    {
                                        JSONRefreshResponse = JSON.parse(refreshResponse);
                            
                                        console.log('refreshResponse', refreshResponse);
                                        console.log('JSONRefreshResponse', JSONRefreshResponse);
                            
                                        datas.access_token = JSONRefreshResponse.access_token;
                                        datas.refresh_token = JSONRefreshResponse.refresh_token;
                            
                                        // response.setCookie("at", JSONRefreshResponse.access_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
                                        // response.setCookie("rt", JSONRefreshResponse.refresh_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
                            
                                        
                                    });
                                });

                            refreshReq.write(refreshPostData);
                            refreshReq.end();
                        }
                        /**
                         *
                         * CALL API SUCCEEDED, PRINTING RESPONSE
                         *
                        **/
                        else
                        {
                            datas.api_call_return = JSONResponse;
                            datas.api_call_return_str = JSON.stringify(JSONResponse);

                            response.emit('render', {
                                'status': 200,
                                'template': 'index.html',
                                'datas': datas
                            });
                        }
                    });
                });

            console.log('##################################');
            console.log(postData);
            console.log('##################################');

            req.write(postData);
            req.end();
        }
    },
    _404Controller: function(request, response)
    {
        response.emit('render', {
            'status': 404,
            'template': '404.html',
            'datas': {}
        });
    },
    _staticController: function(request, response)
    {
        response.emit('render', {
            'status': 200,
            'ressourcePath': request.url
        });
    }
};


NjServer.new().init(ROUTES, CONTROLLERS).start();



// ROUTER TEST
// var Router = require("./modules/ninja/router");
// console.log(Router);
// var r = Router.new(CONF);
// r.setRoutes(ROUTES);
// console.log(r);
// r.handle({url:'/other'});
// console.log(r.getControllerName());

// CONTROLLER TEST
// var Controller = require("./modules/ninja/controller");
// console.log(Controller);
// var c = Controller.new(CONF);
// console.log(c);
// c.setControllerName(r.getControllerName());

