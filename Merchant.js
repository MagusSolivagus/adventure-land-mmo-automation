// Merchant class - buys, stores and sells stuff, cannot fight

// Checks who is in party and their stats (names, hp, mana, etc...)
function whoarewe() {
	let who_is_in_party = [] // empty list as placeholder
	if (character.party == null) return who_is_in_party;
	let party_names=Object.keys(get_party()); // extracts party member names
	for (let name of party_names) { 		// loops through party_names
		let memberstats = get_player(name); // names get into a variable
		if (!memberstats) continue; // if None, continue without crash
		who_is_in_party.push(memberstats); // put party into the placeholder
	}
	return who_is_in_party; // returns each members stats to function
}


function buy_mana_potions() {
	let mp_needed = Math.max(0, 1500 - quantity("mpot0"));
	if(mp_needed) {
		buy_with_gold("mpot0", mp_needed);
		game_log(`Restocked ${mp_needed} Mana Potions`);
	}
}

// give potions to fighers
function mana_delivery() {
	let party_members = whoarewe();
	if(!party_members) return;
	let mana_pot = locate_item("mpot0");
	for(let member of party_members) {
		if(member !== character) {
			send_item(member,mana_pot, 500);
			game_log(`send ${member.name} Mana-Potions!`);
		}
	}
}
// at the moment, sell specific items found by fighter group
function sellable_items() {
	let sellme = [];
	for(let i = 0; i < 42; i++) {
		let item = character.items[i];
        if (!item) continue; 
        if (item.name == "vitring" ||
			item.name == "strring" ||
			item.name == "intring" ||
			item.name == "dexring" ||
			item.name == "wattire") {
				sellme.push(i);
		}
	}
	for(let slot of sellme) {
		let items_to_sell = character.items[slot];
		if(items_to_sell) {
			sell(slot, 1);
		}
	}
}

// get current position in world
function current_position() {
	let cur_pos = [];
	cur_pos.push(character.map);
	cur_pos.push(character.x);
	cur_pos.push(character.y);
	return cur_pos;
}

// receive position of Gulrot, go to him and collect loot/money, return to main
// runs everytime Kaal receives data from Gulrot, every 15 minutes
// received data comes in an array as above in the current_position() function
async function receive_pos_goto_gul(name,data) {
	if(name !== "Gulrot") return;
	close_stand();
	let gul_map = data[0];
	let gul_x = data[1];
	let gul_y = data[2];
	if(character.map !== gul_map && !is_moving(character)) { 
		await smart_move(gul_map);
	}
	await smart_move({
		x: gul_x,
		y: gul_y
	});
	mana_delivery();
	await sleep(1000 * 60);
	use_skill("use_town");
	await sleep(1000 * 5);
	await smart_move("main");
	await sleep(1000 * 2)
	await smart_move("fancypots");
	await buy_mana_potions();
	await sellable_items();
	await smart_move({
		x: -116,
		y: 14
		});
	await sleep(1000 * 2)
	open_stand();
}

function exchange_items_xyn(itemName) {
    let itemIndex = character.items.findIndex(item => item && item.name === itemName);
    if (itemIndex !== -1) {
        exchange(itemIndex);
    }
}

// passive  regeneration
function regenerate() {
	// passive hp regen unless character is missing more than 100 mana
	if (character.hp < character.max_hp && can_use("regen_hp") && character.mp > character.max_mp - 100) {
		set_message("Regen HP");
		use_skill("regen_hp");
		return;
	}
	// passive mp regen
	if (character.mp < character.max_mp && can_use("regen_mp")) {
		set_message("Regen MP");
		use_skill("regen_mp");
		return;
	}
}

//get nearby players
function playersearch() {
	let playerlist = [] // create empty list
	// loop through entities around me
	for(let ppl_around_me of Object.values(parent.entities)) { 
		if(!is_player(ppl_around_me)) { // if entity is not a player, skip them
			continue;
		}
	playerlist.push(ppl_around_me); // put every looped player into the list
	}
	return playerlist; // return list when function is called
}

function mluck_buff() {
	let players_around_me = playersearch();
	for(let player of players_around_me) {
		let no_buff = !player.s || !player.s["mluck"];
		let buff_from_others = player.s && player.s["mluck"] && player.s["mluck"].f !== character.name;
		if((no_buff || buff_from_others) && player.ctype !== "merchant" && is_in_range(player)) {
			set_message("M-Luck buff!");
			use_skill("mluck", player);
			return;
		}
	}
}

//Mass Produce skill
function mass_produce() {
	if(character.level < 30) {
		return;
	}
	if(!character.s.massproduction) {
		set_message("Mass Prod.");
		use_skill("massproduction", character);
		return;
	}

}
// sleeper agent, waits for right command and instantly activates
function on_cm(name,data) {
	receive_pos_goto_gul(name,data);
}

setInterval(function(){
	
	mluck_buff();
	
	mass_produce();
	
	regenerate();
	
},1000/4); // Loops every 1/4 seconds.

setInterval(function(){
	
	//exchange_items_xyn("marketparcel");
	
},1000 * 2); // loops every 2 seconds
