let attack_mode = false;

let follow_mode = true;

// these are all functions for the main loop. The main loop is at the bottom.

// Checks who is in party and their stats (names, hp, mana, etc...)
function whoarewe() {
	let who_is_in_party = [] // empty list as placeholder
	if (character.party === null) return who_is_in_party;
	let party_names=Object.keys(get_party()); // extracts party member names
	for (let name of party_names) { 		// loops through party_names
		let memberstats = get_player(name); // put stats of name in variable
		if (!memberstats) continue; // if None, continue without crash
		who_is_in_party.push(memberstats); // put party into the placeholder
	}
	return who_is_in_party; // returns each members stats to function
}

//search for warrior in group
function tank_search() {
	let group = whoarewe();
	if(!group) return;
	let leader = null;
	for(let member of group) {
		if(member.ctype === "warrior") {
			leader = member;
			break;
		}
	}
	return leader;
}


// join party - Gulrot
function summon_party() {
	if (character.party != null) {
		return;
	}
	accept_party_invite("Gulrot");
	set_message("Waiting for Gulrot");
}


//switching follow/battle mechanic
async function update_cf_mode() {
	let leader = tank_search();
	if (leader === null) { 
		follow_mode = false;
		return; 
	}
	let leader_actual_target = get_target_of(leader);
	if(leader) {
		if(leader_actual_target && !leader_actual_target.rip) {
			follow_mode = false
			attack_mode = true
		} else {
			follow_mode = true
			attack_mode = false
		}
	}
	if (follow_mode == true && distance(character, leader) > 15) {
		set_message(`Follow: ${leader.name}`);
		await xmove(
			character.x+(leader.x-character.x) * 0.8,
			character.y+(leader.y-character.y) * 0.8
			);
	}
}

// seek nearest new target / prioritize phoenix
function seek_monster() {
	let target=get_targeted_monster();
	if(target && target.rip) {
		target = null
	} //if no target or target is not type "phoenix"
	if(!target || target.mtype !== "phoenix") { 
		let is_pho = get_nearest_monster({ // search for phoenix nearby
		type: "phoenix",
		})
		if(is_pho) {
			set_message(`Found: ${is_pho.name}`); 
			change_target(is_pho); //if found, target it immediently
			game_log(`${character.name} found a ${is_pho.name}`); 
			return is_pho; // return phoenix to overwrite old target 
		}
	} 
	if(target && !target.rip) {
	   return target;
	}
	if(!target) {
		target = get_nearest_monster({
		min_xp:100,
		max_att:200,
		max_distance:20,
		path_check:true
		})
		if(target) {
			set_message(`Found: ${target.name}`)
			change_target(target);
			return target;
		}
	}
	return target;
}

// sending items and gold to Kaal if online and neaby
function send_to_Kaal() {
	if (character.gold > 60000 && get_player("Kaal")) {
		send_gold("Kaal", 50000);
	}
	
	if (get_player("Kaal")) { 
    for (let i = 0; i < 42; i++) {
        let item = character.items[i];
        if (!item) continue; 
        if (item.name == "hpot0" || item.name == "mpot0") continue;
        send_item("Kaal", i, item.q || 1);
    	}
	}
}

// potion and regeneration
function drink_potion() {
	// if 33% hp, use a health potion
	if (character.hp < character.max_hp / 3 && can_use("use_hp")) {
		set_message("Drink HP");
		use_skill('use_hp');
		return;
	}
	// if 50% mana, use mana potion
	if (character.mp < character.max_mp / 2 && can_use("use_mp")) {
		set_message("Drink MP");
		use_skill('use_mp');
		return;
	}
	// passive hp regen unless character has less than 90% of mana
	if (character.hp < character.max_hp - 50 && can_use("regen_hp") && character.mp > character.max_mp - 100) {
		set_message("Regen HP");
		use_skill("regen_hp");
		return;
	}
	// passive mp regen
	if (character.mp < character.max_mp - 100 && can_use("regen_mp")) {
		set_message("Regen MP");
		use_skill("regen_mp");
		return;
	}
}

// Use standard heal skill
function small_heal() {
	if (character.party == null) {
		if (character.hp < character.max_hp * 0.75 && can_use("heal")) {
			set_message(`Healing ${character.name}`);
			use_skill("heal", character);	
		}
		return;
	}
	let group = whoarewe(); // party stats in variable
	if (!group) return; // if None, continue without crash
	group.sort(function(a, b) {				// sort stats, compare two characters
		return (a.hp / a.max_hp) - (b.hp / b.max_hp); // sort characters by hp%
	});
	let member = group[0]; // least hp% character is priority
	if (member.hp < member.max_hp * 0.75) { // if member 75% hp
		if(!is_in_range(member, "heal")) {// if member is out of range
			move(
				character.x+(member.x-character.x)/2,
				character.y+(member.y-character.y)/2
				);
			return;
		}
		if(can_use("heal")) {
			use_skill("heal", member);
			set_message(`Healing ${member.name}`);
			return;
		}
	}
}

function party_heal() {
	let members = whoarewe();
	for(let member of members) {
		if(member.hp < member.max_hp / 4 && character.mp > 400 && can_use("partyheal")) {
			use_skill("partyheal");
			set_message("Party Heal!");
			return;
		} else if (character.mp < 400 && can_use("use_mp")) {
			set_message("OOM P-Heal");
			use_skill("use_mp");
			return; 
		}
	}
}

// curse skill for harder enemies
function curse_boss() {
	let leader = tank_search();
	if(!leader) {
		let s_target = character.target;
		if(s_target.max_hp > character.max_hp * 10 && character.mp > 400) {
			if(can_use("curse")) {
				use_skill("curse", s_target);
				set_message(`Curse ${s_target.name}`);
				return;
			}
		}
	}
	let target = get_target_of(leader);
	if(!target) return;
	if(target.s === "cursed") {
		return;
	}
	if(target.max_hp > leader.max_hp * 10 && character.mp > 400) {
		if(can_use("curse")) {
			use_skill("curse", target);
			set_message(`Curse ${target.name}`);
			return;
		}
	} 
	else if (character.mp < 400 && can_use("use_mp")) {
		set_message("OOM Curse");
		use_skill("use_mp");
		return; 
	}
}

// solo_attack
function solo_attack() {
	let target = seek_monster();
	if (!target || target.rip) return;
	if(!is_in_range(target)) {
		move(
			character.x+(target.x-character.x)/2,
			character.y+(target.y-character.y)/2
			);
		// Walk half the distance
	}
	else if(can_attack(target)) {
		set_message(`Atk on: ${target.name}`);
        attack(target);
		return;
	}
}


// In group standard attack
function lt_attack() {
	let leader = tank_search();
	if(!leader) return;
   	let target = get_target_of(leader);
	if (!target || target.rip) return;
	if(!is_in_range(target)) {
		move(
			character.x+(target.x-character.x)/2,
			character.y+(target.y-character.y)/2
			);
		// Walk half the distance
	}
	else if(can_attack(target)) {
		set_message(`Atk on: ${target.name}`);
        attack(target);
		return;
	}
}

// using "Absorb Sins" to pull aggro away from low HP party
function tank_low_party() {
	if(character.level < 55) return;
	let group = whoarewe();
	if(!group) return;
	for( let member of group) {
		if(member.hp < member.max_hp / 4 && can_use("absorb")) {
			use_skill("absorb")
			set_message("Absorb low-HP!")
			return;
		}
	}
}

// Dark blessing, buff atk by 25%
function d_bless_atk_buff() {
	if(character.level < 70) return;
	let group = whoarewe();
	if(!group) {
		if(character.mp >= 900 && can_use("darkblessing")) {
			set_message(`Blessing ${character.name}!`);
			use_skill("darkblessing");
			return;
		}
	}
	group.sort = (function(a, b) { // sort member atk stats
		return (b.atk) - (a.atk);	   // highest atk is first in list
	});
	let top_atk_member = group[0];  // grab highest atk member
	if(character.mp >= 900 && can_use("darkblessing")) {
		set_message(`Blessing ${top_atk_member.name}!`);
		use_skill("darkblessing", top_atk_member);
		return;
	}
}

// solo battle
function solo_battle() {
	
	small_heal();
	
	d_bless_atk_buff();
	
	solo_attack();
}
// group battle 
function group_battle() {
	// pull aggro from low party members
	tank_low_party()
	
	//partyheal if below 25% hp
	party_heal();
	// single target standard heal if member at 75% hp
	small_heal();
	
	// curse tougher enemies
	curse_boss();
	
	// Use standard attack on leader target
	lt_attack();
}


// accept Gulrots party invite every 10 seconds
setInterval(function(){ 
	summon_party();
}, 1000 * 10);

setInterval(function(){ 
	update_cf_mode();
}, 1000);

//mainloop every 0.25 seconds
setInterval(function(){
	// send Kaal items and gold
	send_to_Kaal();
	// drink potion at 25% hp or 50% mana / passive mp/hp regen
	drink_potion();
	
	loot();
	
	if(!attack_mode || character.rip) return;
	
	if(character.party !== null) {
		group_battle();
	}
	else {
		solo_battle();
	}
	

},1000/4); // Loops every 1/4 seconds.
