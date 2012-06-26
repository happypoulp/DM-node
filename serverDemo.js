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
    secret = process.env.DM_API_SECRET,
    redirectBaseUrl = process.env.DM_API_REDIRECT_BASE_URL;

if (!key && !secret && !redirect_uri)
{
    return console.log('Usage: node serverDemo.js / with env variables : DM_API_KEY, DM_API_SECRET, DM_API_REDIRECTURI');
}

global.CONF = {
    serverHost: '127.0.0.1',
    redirectBaseUrl: redirectBaseUrl || 'http://127.0.0.1:8000',
    serverPort: process.env.PORT || 8000,
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

var Utilities = {
    get_dm: function(request)
    {
        return dm.set_grants_from_request(request);
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
        var datas = baseDatas,
            grants = dm.get_grants_from_request(request);

        datas.grants = grants;

        if (!datas.grants.access_token)
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
            var login = request.getCookie('user');

            if (login)
            {
                datas['user'] = login;

                response.emit('render', {
                    'status': 200,
                    'template': 'index.html',
                    'datas': datas
                });
            }
            else
            {
                Utilities.get_dm(request).call(
                    {call: '/user/me?fields=username'},
                    function(d, grants)
                    {
                        console.log(d);
                        dm.update_grants(grants, response);

                        response.setCookie("user", d.result.username, {expires: new Date().getTime() + (1000*60*60*24*365)})
                        datas['user'] = d.result.username;

                        response.emit('render', {
                            'status': 200,
                            'template': 'index.html',
                            'datas': datas
                        });
                    }
                );
            }
        }
    },
    login : function(request, response)
    {
        baseDatas.authorize_url = dm.get_authorize_url(CONF.redirectBaseUrl + '/oauth_success', ['read', 'write']);

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
            dm.update_grants(datas, response);

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
        if (request.GETS.call)
        {
            // TODO BETTER : return request or response of call and register req/res.on("error", f(){if expired, refresh, else print error})
            Utilities.get_dm(request).call(
                baseDatas.actions[request.GETS.call] || {call: request.GETS.call},
                function(datas, grants)
                {
                    dm.update_grants(grants, response);

                    response.emit('render', {
                        'status': 200,
                        'template': 'index.html',
                        'datas': {
                            call: request.GETS.call,
                            api_call_return: JSONResponse,
                            api_call_return_str: JSON.stringify(JSONResponse),
                            grants: dm.get_grants()
                        }
                    });
                }
            );
        }
    },
    reset : function(request, response)
    {
        var datas = baseDatas;

        response.clearCookie('at');
        response.clearCookie('rt');
        response.clearCookie('ie');
        response.clearCookie('user');

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

