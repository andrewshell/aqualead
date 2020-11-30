const packagejson = require('./package.json');
const outlines = require('./outlines.json');

const bodyParser = require('body-parser');
const crypto = require('crypto');
const dayjs = require('dayjs');
const express = require('express');
const exphbs = require('express-handlebars');
const fs = require('fs');
const opml2json = require('./opml2json');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));

function md5(data) {
    return crypto.createHash('md5').update(data).digest("hex"); 
}

function findByHash(md5hash) {
    return outlines.findIndex(function (outline) {
        return md5hash === outline.md5;
    });
}

function revChron(body) {
    let list = [];
    if (Array.isArray(body.subs)) {
        body.subs.forEach(function (sub) {
            list.push({ text: sub.text, created: sub.created });
            if (sub.subs !== undefined) {
                list = list.concat(revChron(sub));
            }
        });
    }
    return list.sort(function (a, b) {
        return b.created - a.created;
    });
}

function filterBody(body, created) {
    let outline = null;
    if (Array.isArray(body.subs)) {
        for (let sub of body.subs) {
            if (dayjs(sub.created).isSame(dayjs(created, 'YYYYMMDDHHmmss'))) {
                outline = sub;
            } else {
                outline = filterBody(sub, created)
            }
            if (outline !== null) {
                break;
            }
        }
    }
    return outline;
}

const hbs = exphbs.create({
    helpers: {
        datestr: function (created) {
            return dayjs(created).format('YYYYMMDDHHmmss');
        }
    }
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.get('/', (req, res) => {
    res.render('home', { outlines });
})

app.get('/:md5hash', (req, res) => {
    const md5hash = req.params.md5hash;
    const idx = findByHash(md5hash);

    if (idx === -1) {
        return res.status(404).send('Not Found');
    }

    opml2json.readOpmlUrl(outlines[idx].opmlurl, function (err, jstruct) {
        res.render('page', { 
            title: jstruct.head.title, 
            recents: revChron(jstruct.body).slice(0, 25), 
            subs: jstruct.body.subs,
            md5hash: md5hash
        });
    });
})

app.get('/:md5hash/:created', (req, res) => {
    const md5hash = req.params.md5hash;
    const created = req.params.created;
    const idx = findByHash(md5hash);

    if (idx === -1) {
        return res.status(404).send('Not Found');
    }

    opml2json.readOpmlUrl(outlines[idx].opmlurl, function (err, jstruct) {
        const outline = filterBody(jstruct.body, created);

        if (outline === null) {
            return res.status(404).send('Not Found');
        }

        res.render('page', { 
            title: outline.text, 
            recents: revChron(outline).slice(0, 25), 
            subs: outline.subs,
            md5hash: md5hash
        });
    });
})

app.post('/', (req, res) => {
    opml2json.readOpmlUrl(req.body.opmlurl, function (err, jstruct) {
        const md5hash = md5(req.body.opmlurl);
        const idx = findByHash(md5hash);

        if (idx === -1) {
            outlines.push({
                md5: md5hash,
                title: jstruct.head.title,
                opmlurl: req.body.opmlurl
            });
        } else {
            outlines[idx].title = jstruct.head.title;
        }

        fs.writeFileSync('outlines.json', JSON.stringify(outlines), 'utf8');

        res.redirect('/');
    });
})

app.listen(port, function () {
    console.log(`${packagejson.name} v${packagejson.version}`);
    console.log(`Example app listening at http://localhost:${port}`)
})
