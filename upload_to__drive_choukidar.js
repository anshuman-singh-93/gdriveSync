// variables section
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var chokidar = require('chokidar');
var last_time_script_run_file_path='last-timestamp.txt';
var watcher = chokidar.watch('./documents/', {ignored: /[\/\\]\./, persistent: true});
var log = console.log.bind(console);
var last_time_script_executed;// this contains the date-time when last time script was executed


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';

// Load client secrets from a local file.



last_time_script_executed=fs.readFileSync(last_time_script_run_file_path).toString();
if(last_time_script_executed.length==0) {
    last_time_script_executed=new Date();
    var a = fs.writeFileSync(last_time_script_run_file_path,new Date() );// store the last executed time in a file

}


function exitHandler(options, err) {
    var a = fs.writeFileSync(last_time_script_run_file_path,new Date() );
    
    console.log('modified time'+  new Date()+' '+ 'has been saved');
    if (options.cleanup) console.log('exiting');
    if (err) console.log(err.stack);
    if (options.exit) process.exit();

}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null,{exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind({exit:true}));



watcher
    .on('add',function (path) {

        log('File', path, 'has been added');
       var file_name=path.slice(10);
       var file_extension=path.split('.')[1];
        fs.stat(path, function (err, stats) // check the last modified time of file
        {
            if (err)
            {
                return console.error(err);
            }
            else
            {

                console.log('last time script was run at '+last_time_script_executed+" "+"and files last modified time is "+stats.mtime);

                if(stats.mtime.getTime()>(new Date(last_time_script_executed).getTime()))
                {
                    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
                        if (err) {
                            console.log('Error loading client secret file: ' + err);
                            return;
                        }
                        // Authorize a client with the loaded credentials, then call the
                        // Drive API.
                        authorize(JSON.parse(content), createfiles,file_name,file_extension);
                    });

                }
            }
        });


    })
    .on('change', function (path) {
        log('File', path, 'has been changed');
    })
    .on('unlink', function (path) {
        log('File', path, 'has been deleted');
        var file_name=path.slice(10);
        var file_extension=path.split('.')[1];
        fs.readFile('client_secret.json', function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            // Authorize a client with the loaded credentials, then call the
            // Drive API.
            authorize(JSON.parse(content), deletefile,file_name,file_extension);
        });
    })
.on('error',function (error) {
    log('Watcher error: ${error}')});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback,file_name,file_extension) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client,file_name,file_extension);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    var service = google.drive('v3');
    service.files.list({
        auth: auth,
        pageSize: 400,
        fields: "nextPageToken, files(id, name)"
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var files = response.files;
        if (files.length == 0) {
            console.log('No files found.');
        } else {
            console.log('Files:');
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                console.log('%s (%s)', file.name, file.id);
            }
        }
    });
}

function createfiles(auth,file_name,file_extension) {
    var drive = google.drive({ version: 'v3', auth: auth });
    var mimeType;
    if(file_extension==='doc')
        mimeType='application/msword';
    else if(file_extension==='docx')
        mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if(file_extension==='pdf')
        mimeType='application/pdf';
    drive.files.create({
        auth: auth,resource: {
            name: file_name,
            mimeType: mimeType
        },
        media: {
            mimeType: mimeType,
            body: fs.createReadStream('./documents/'+file_name)// this is my local pdf that i have uploaded
        }
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        else
        {
            console.log(response);
        }
    });
}



function deletefile(auth,file_name,file_extension) {
    var mimeType;
    if(file_extension==='doc')
        mimeType='application/msword';
    else if(file_extension==='docx')
        mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if(file_extension==='pdf')
        mimeType='application/pdf';
    var drive = google.drive({ version: 'v3', auth: auth });
    file_name=file_name;
    drive.files.list({
        auth: auth,
        q:"name contains \'"+file_name+"\'"+"and mimeType=\'"+mimeType+"\'"
    

    }, function(err, response) {
        var files_list='';
        var file_id='';
        var file_name='';
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        else
        {
            files_list=response.files;
            if(files_list.length==0)
            {
                console.log('file is not found on drive');
            }
            else
            {
                file_id=files_list[0].id;
                file_name=files_list[0].name;
               // console.log(response);
                console.log(file_id);
                drive.files.delete({auth:auth,fileId:file_id},function (err,res) {
                    if (err) {
                        console.log('The API returned an error in deleting the file: ' + err);
                        return;
                    }

                    else
                    {
                        console.log('file '+ file_name+' has been deleted from drive');
                    }

                })

            }
        }
    });
}