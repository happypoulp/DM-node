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
var root = process.cwd(),
    key = process.env.DM_API_KEY,
    secret = process.env.DM_API_SECRET;

if (!key && !secret && (process.argv.length <= 2 || !process.argv[2].match(/key=|secret=/) || !process.argv[3].match(/key=|secret=/)))
{
    return console.log('Usage: node serverDemo.js key=<api_key> secret=<api_secret>');
}

key = key || (process.argv[2].match(/key=/) ? process.argv[2].replace(/key=/, '') : process.argv[3].replace(/secret=/, '')),
secret = secret || (process.argv[3].match(/key=/) ? process.argv[3].replace(/key=/, '') : process.argv[3].replace(/secret=/, ''));

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
    DM = require("./modules/dm-api"); // DM API

/*************************************************
 *
 * ALL ROUTES - MAPPING BETWEEN "URI" AND CORRESPONDING "CONTROLLER NAME"
 *
**************************************************/
var ROUTES = {
    '/': 'index',
    '/login': 'login',
    '/reset': 'reset',
    '/oauth_success': 'oauth_success',
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
            args:
            {
                "message": "This is a useless message..."
            }
        },
        videolist: {
            call: 'video.list',
            args:
            {
                "localization": "detect",
                "fields": ["id", "title"],
                "channel": "tv"
            }
        },
        videoinfo: {
            call: 'video.info',
            args:
            {
                "id": "xf3tgr",
                "fields": ["title", "description", "url", "duration", "thumbnail_large_url"]
            }
        },
        videoedit: {
            call: 'video.edit',
            args:
            {
                "id": "xf3tgr",
                "title": "tranquilize edtited"
            }
        }
    }
};


var dm = DM.new().init({
    client_id: key,
    client_secret: secret
});

function getDM(request)
{
    return dm.set_access_token(request.getCookie('at'))
        .set_refresh_token(request.getCookie('rt'))
        .set_expires_in(request.getCookie('ei'));
}

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
        var currentDate = new Date();
        currentDate.setTime(parseInt(request.getCookie("ei")));
        datas.expires_at = currentDate.toString();

        if (!datas.access_token)
        {
            response.emit('render', {
                'status': 302,
                'headers': {
                    'Location': '/login'
                }
            });
        }
        else
        {
            response.emit('render', {
                'status': 200,
                'template': 'index.html',
                'datas': datas
            });
        }
    },
    login : function(request, response)
    {
        baseDatas.authorize_url = dm.get_authorize_url('http://'+ CONF.serverURL + '/oauth_success', ['read', 'write']);

        response.emit('render', {
            status: 200,
            template: 'login.html',
            datas: {
                login_url: baseDatas.authorize_url
            }
        });
    },
    oauth_success : function(request, response)
    {
        dm.get_access_token(request.GETS, function(datas)
        {
            response.setCookie("at", datas.access_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
            response.setCookie("rt", datas.refresh_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
            response.setCookie("ei", new Date().getTime() + datas.expires_in*1000, {expires: new Date().getTime() + (1000*60*60*24*365)});

            response.emit('render', {
                status: 302,
                'headers': {
                    'Location': '/'
                }
            });
        });
    },
    api_action: function(request, response)
    {
        if (request.GETS.call && baseDatas.actions[request.GETS.call])
        {
            getDM(request).call(baseDatas.actions[request.GETS.call], function(datas)
            {
                var access_token = request.getCookie("at");
                refresh_token = request.getCookie("rt");
                expires_in = request.getCookie("ei");

                console.log(datas);

                if (datas.access_token)
                {
                    access_token = datas.access_token;
                    response.setCookie("at", access_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
                }
                if (datas.refresh_token)
                {
                    refresh_token = datas.refresh_token;
                    response.setCookie("rt", refresh_token, {expires: new Date().getTime() + (1000*60*60*24*365)});
                }
                if (datas.expires_in)
                {
                    expires_in = datas.expires_in;
                    response.setCookie("ei", new Date().getTime() + expires_in*1000, {expires: new Date().getTime() + (1000*60*60*24*365)});
                }

                var currentDate = new Date();
                currentDate.setTime(parseInt(request.getCookie('ei')));
                expires_at = currentDate.toString();

                response.emit('render', {
                    'status': 200,
                    'template': 'index.html',
                    'datas': {
                        call: request.GETS.call,
                        api_call_return: JSONResponse,
                        api_call_return_str: JSON.stringify(JSONResponse),
                        access_token: access_token,
                        refresh_token: refresh_token,
                        expires_at: expires_at
                    }
                });
            });
        }
    },
    reset : function(request, response)
    {
        var datas = baseDatas;

        response.clearCookie('at');
        response.clearCookie('rt');

        response.emit('render', {
            status: 302,
            'headers': {
                'Location': '/'
            }
        });
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

