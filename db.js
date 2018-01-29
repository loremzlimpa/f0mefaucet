
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('databasefilename')
const db = low(adapter)
db.defaults({ accounts: []}).write();
module.exports = {
    loadAccounts: () => {
      var accounts = {};
      var rows = db.get('accounts').value();
      rows.forEach((row) => {
	       accounts[row.id] = {lasttx: row.lasttx};
	      });
      module.exports.accountLoader.emit("loaded", accounts);
    },

  addNewUser: (usrid) => {
	const numacc =  db.get('accounts').find({ id: usrid }).size().value();
	if (numacc != 0)
		{
		 console.log("conflict writing ");
			return;
		}
	console.log("add new user " + usrid);
        db.get('accounts')
          .push({ id:usrid, lasttx: ""})
          .write();

    },

    update: (usrid, tx_time) => {
          db.get('accounts')
          .find({ id: usrid })
          .assign({ lasttx:  tx_time })
          .write();
        console.log('db update');
      },
    accountLoader: new (require("events"))()
};
