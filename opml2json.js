const fetch = require('node-fetch');
const OpmlParser = require('opmlparser');

function readOpmlUrl(urlOpml, callback) {
    const opmlparser = new OpmlParser({ opmlurl: urlOpml });
    fetch(urlOpml).then(res => res.body.pipe(opmlparser));

    opmlparser.on('error', function(error) {
        console.error(error);
    });

    let nodes = {};

    opmlparser.on('readable', function() {
        const stream = this,
            stack = this.stack;

        let outline;

        while (outline = stream.read()) {
            const id = outline['#id'], parentid = outline['#parentid'];

            delete outline['#id'];
            delete outline['#parentid'];

            if (outline.created) {
                outline.created = new Date(outline.created);
            }

            if (nodes[id]) {
                outline.subs = nodes[id];
                delete nodes[id];
            }

            if (!nodes[parentid]) {
                nodes[parentid] = [];
            }

            nodes[parentid].push(outline);
        }
    });

    opmlparser.on('end', function() {
        const meta = this.meta;
        const jstruct = {
            head: this.meta,
            body: { subs: nodes[0] },
        };

        delete nodes[0];

        callback(null, jstruct);
    });
}

exports.readOpmlUrl = readOpmlUrl;
