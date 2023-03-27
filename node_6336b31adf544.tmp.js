// Importerer nødvendige Node.js moduler og pakker
const express = require("express");
const session = require("express-session");
const path = require("path");
const hbs = require("hbs");
const app = express();
const bcrypt = require("bcrypt");
const db = require('better-sqlite3')('database.db')

// Setter opp Handlebars som view engine
app.set("view engine", hbs);
// Parsing av URL-encoded data i request body
app.use(express.urlencoded({extended: true}))
// Setter opp filbanen for views-mappen
app.set("views", path.join(__dirname, "./views/pages"))
// Statiske filer som CSS og bilder blir gjort tilgjengelig gjennom en offentlig mappe
app.use(express.static(path.join(__dirname, '/public')));

// Setter opp session og setter secret
app.use(session({
    secret: "spurserbest",
    resave: false,
    saveUninitialized: false
}))
//Login rute
app.post("/login", async (req, res) => {
    // koden forsøker å hente en hash fra databasen basert på en riktig e-postadresse. Hvis det oppstår en feil under kjøringen, vil koden ikke krasje, men i stedet bruke en popup
    try {
      let login = req.body;
      let userData = db.prepare("SELECT * FROM brukere WHERE email = ?").get(login.email);
    // Sjekker om hashen i databsen stemmer med input fra brukeren
      if(await bcrypt.compare(login.password, userData.hash)) {
        // Bruker blir logget inn
        req.session.loggedin = true
        // Session lagrer brukerid-en for å lage nytt lag og slette riktig bruker.
        req.session.brukerid = userData.id
        // Sjekker om brukeren er admin og lagrer dette i session
        if(userData.admin === 1 ) {req.session.isAdmin = true}
        res.redirect("/")
      } else {
        res.redirect("back")
      }
    // Sender popup til nettsiden og sender deg tilbake til login når du trykker ok.
    } catch (err) {
        res.send('<html><body><script>alert("Du har tastet inn feil brukernavn eller passord");window.location.href="/";</script></body></html>');
    }
  });
// Ødelegger session til brukeren når den trykker på loggut knapp på nettsiden
app.post("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("back")
})


//Gjennomfører en konkurranse mellom to lag hvor vinneren er tilfeldig
app.post("/konkurranse", (req, res) => {
  if (req.session.isAdmin) {
    let hjemmelag = req.body.hjemmelag;
    let bortelag = req.body.bortelag;
    if (Math.random() < 0.5) {
      let seiere = db.prepare("SELECT seiere FROM fantasilag WHERE id = ?").get(hjemmelag).seiere;
      db.prepare("UPDATE fantasilag SET seiere = ? WHERE id = ?").run(seiere + 1, hjemmelag);
    } else {
      let seiere = db.prepare("SELECT seiere FROM fantasilag WHERE id = ?").get(bortelag).seiere;
      db.prepare("UPDATE fantasilag SET seiere = ? WHERE id = ?").run(seiere + 1, bortelag);
    }
    res.redirect("back");
    // Sender en alert til nettsiden viss man prøver å kjøre konkurranse uten å være admin. Blir sendt tilbake til hovedsiden.
  } else {
    res.send('<html><body><script>alert("Du har ikke rettighetene til å kjøre konkurranse");window.location.href="/";</script></body></html>');
  }
});
// Legger til ny bruker
app.post("/addUser", async (req, res) => {
    let svar = req.body;
    // Her blir passordet hashet før det blir lagret i databsen
    let hash = await bcrypt.hash(svar.password, 10)
    db.prepare("INSERT INTO brukere (name, email, hash, admin) VALUES (?,?,?,?)").run(svar.name, svar.email, hash, 0)
    res.redirect("/laglag")
    
})
// Sletter bruker
app.post("/removeUser", (req, res) => {
    // Sjekker om du er logget inn
    if(req.session.loggedin) {
    // Sjekker om brukeren har bekreftet sletting
    if (req.body.slett === "BEKREFT") {
        // Sletter brukeren ved å hente id-en som ble lagret ved innlogging.
        db.prepare("DELETE FROM brukere WHERE brukere.id = ?").run(req.session.brukerid)
        // Ødelegger session for at bruker ikke skal ha tilgang til nettsiden etter at brukeren har blitt slettet
        req.session.destroy();
        res.send('<html><body><script>alert("Brukeren din har blitt slettet!");window.location.href="/";</script></body></html>');
    }
    else (res.redirect("back"))}
    // Sender deg til login viss man prøver å slette bruker uten å være innlogget
    else{res.redirect("/")}
})
// Registrer nytt fantasilag. En bruker kan ha flere lag
app.post("/registrerlag", (req, res) => {
    if(req.session.loggedin) {
    let svar = req.body
    // Setter inn nytt lag i databasen
    db.prepare("INSERT INTO fantasilag (lagnavn, lageier, S, VM, M, HM, VB, HB, K) VALUES (?,?,?,?,?,?,?,?,?)").run(svar.lagnavn, req.session.brukerid, svar.spiss, svar.venstremidt, svar.midt, svar.hoyremidt, svar.venstreback, svar.hoyreback, svar.keeper)
    res.redirect("/")}
    else {res.redirect("back")}
})


app.get("/registrer", (req, res) => {
    res.render("registrer.hbs") 
})
app.get("/", (req, res) => {
    if(req.session.loggedin) {
        let fantasilag = db.prepare("SELECT fantasilag.id AS fantasilagid, * FROM fantasilag JOIN brukere ON brukere.id = fantasilag.lageier").all()
        let objekt = {fantasilag: fantasilag}
        res.render("index.hbs", objekt)
    } else {
        res.render("login.hbs")
    }    
})
app.get("/slett", (req, res) => {
    if(req.session.loggedin) {
        res.render("slettbruker.hbs")}
    else{res.redirect("/")}
})
app.get("/laglag", (req, res) => {
    if (req.session.loggedin) {
    let spiss = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'S'").all()
    let venstremidt = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'VM'").all()
    let midt = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'M'").all()
    let hoyremidt = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'HM'").all()
    let venstreback = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'VB'").all()
    let hoyreback = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'HB'").all()
    let keeper = db.prepare("SELECT * FROM fotballspillere WHERE posisjon = 'K'").all()

    let objekt = {
        spiss: spiss,
        venstremidt: venstremidt,
        midt: midt,
        hoyremidt: hoyremidt,
        venstreback: venstreback,
        hoyreback: hoyreback,
        keeper: keeper
    }
    res.render("lagLag.hbs", objekt) 
}
else {
    res.redirect("/")
}
})




// Applikasjonen starter på kjøre på port 3000
app.listen("3000", () => {
    console.log("up at  http://localhost:3000")
})
