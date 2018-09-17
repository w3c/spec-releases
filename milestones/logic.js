(function() {
  // For debugging
  let trace = function () {};

  function _trace(msg) {
	   console.log(msg);
  }

  if (window.location.href.includes("file:")) {
    trace = _trace;
  }

  function log(msg) {
    let pre = document.getElementById("log");
    let text = pre.textContent;
    if (text !== "") {
      text += "\n";
    }
    pre.textContent = text + msg;
  }

  function clearLog() {
    let pre = document.getElementById("log");
    pre.textContent = "";
  }

  let config = {
    item: "rec",
    noFPWD: false
  }

  function convertDate(dateInput) {
    return moment(dateInput + "T10:00:00-04:00"); // US/Eastern timezone;
  }

  // For publication moratoria
  // this is populated later by fetching the moratoria.json
  let moratoria = [];

  function avoidMoratorium(date) {
    for (var i = 0; i < moratoria.length; i++) {
      let range = moratoria[i];
      if (date.isBetween(range[0], range[1], null, "[]")) {
        return false;
      }
    }
    return true;
  }

  // avoid Saturdays and Sundays
  function inWorkWeek(date) {
    let day = date.day();
    return (day !== 0 && day !== 6);
  }

  // only Tuesdays and Fridays, and avoid moratoria
  function forPublication(item, date) {
    let day = date.day();
    return (item.id === 'cr'
            || ((day === 2 || day === 4)
                && avoidMoratorium(date)));
  }

  // is this date related to a publication?
  function isPublication(item) {
    return item.classList.contains("publication");
  }

  // is this date related to a transition?
  function isTransition(item) {
    return item.classList.contains("transition");
  }

  function updateItem(item, date, up) {
      let originalDate = date;
      let publication = isPublication(item);
      let transition = isTransition(item);
      let msg = "";
      while((publication && !forPublication(item, date))
            || (transition && !inWorkWeek(date))) {
        if (publication) {
          msg += " " + date.format("YYYY-MM-DD") + " is ";
          if (!avoidMoratorium(date)) {
            msg += "in a publication moratorium";
          } else {
            msg += "not a Tuesday or a Thursday";
          }
        } else if (transition) {
          msg += "in the week end";
        }
        msg += "\n";
        date = moment(date).add((up)?1:-1, "days");
      }
      if (!originalDate.isSame(date)) {
        log(originalDate.format("YYYY-MM-DD")
          + " didn't work out. Picked instead "
          + date.format("YYYY-MM-DD") + "\n" + msg);
      }
      if (publication) {
        item.querySelector("input").value = date.format("YYYY-MM-DD");
      }
      item.querySelector("span.date").textContent = date.format("dddd, MMMM D YYYY");
      item.momentDate = date;
  }
  function adjustDate(item, refItem, up) {
      let refItemDate = moment(item.momentDate);
      let diff = item.dataset.day - refItem.dataset.day;
      updateItem(item, refItemDate.add(diff, "days"), up);
  }

  // clear all dates
  function clearDates() {
    let list = document.querySelectorAll("ul#steps li");
    for (var index = 0; index < list.length; index++) {
      let li = list[index];
      li.momentDate = undefined;
      li.querySelector("span.date").textContent = "";
    }
  }

  // adjust all the dates according to the REC one
  function tuneDates()  {
    trace("Tune all remaining dates to match the REC");

    // update one Item
    function updateLI(li) {
        let refDate = document.getElementById(li.dataset.base).momentDate;
        if (refDate === undefined)
          throw new Error("Can't compute from base " + li.dataset.base);
        let refItemDate = moment(refDate);
        updateItem(li, refItemDate.add(li.dataset.day, "days"), false);
    }
    let list = document.querySelectorAll("ul#steps li");
    // compute all the dates that are using the REC as a base
    for (var index = 0; index < list.length; index++) {
      let li = list[index];
      if (li.momentDate === undefined && li.dataset.base === 'rec'
          && !li.hasAttribute("hidden")) {
        updateLI(li);
      }
    }
    // compute all remaining dates
    for (var index = 0; index < list.length; index++) {
      let li = list[index];
      if (li.momentDate === undefined
          && !li.hasAttribute("hidden")) {
        updateLI(li);
      }
    }

    // adjust reference draft according to transition request for CR
    if (!noFPWD) {
      let toCR = moment(document.getElementById("to-cr").momentDate).add(-1, "days");
      let referenceDraft = document.getElementById("reference-draft").momentDate;
      if (referenceDraft.isAfter(toCR)) {
        log("Shifted reference draft last update to be 1 day before CR transition request");
        updateItem(document.getElementById("reference-draft"), toCR, false);
      }
    }
    // adjust transition request for PR according to deadline for comments
    let commentEnd = moment(document.getElementById("comments").momentDate).add(1, "days");
    let toPR = document.getElementById("to-pr").momentDate;
    if (toPR.isBefore(commentEnd)) {
      log("Shifted transition request for PR to be 1 day after deadline for comments");
      updateItem(document.getElementById("to-pr"), commentEnd, false);
    }
    // adjust end of AC review according to call for exclusions
    let acEnd = document.getElementById("ac-review-end").momentDate;
    if (!noFPWD) {
      let cfe1 = moment(document.getElementById("first-cfe").momentDate).add(10, "days");
      if (acEnd.isBefore(cfe1)) {
        log("Shifted end of AC review to be 10 days after end of 150 days exclusion opportunity")
        updateItem(document.getElementById("ac-review-end"), cfe1, false);
      }
    }
    let cfe2 = moment(document.getElementById("second-cfe").momentDate).add(10, "days");
    if (acEnd.isBefore(cfe2)) {
      log("Shifted end of AC review to be 10 days after end of 60 days exclusion opportunity")
      updateItem(document.getElementById("ac-review-end"), cfe2, false);
    }
    // adjust transition request for REC according to end of AC review
    acEnd = moment(document.getElementById("ac-review-end").momentDate).add(1, "days");
    let toREC = document.getElementById("to-rec").momentDate;
    if (toREC.isBefore(acEnd)) {
      log("Shifted transition request for REC to be 1 day after end of AC review")
      updateItem(document.getElementById("to-rec"), acEnd, false);
    }
  }
  function removeFPWD() {
    trace("Remove FPWD dates");
    config.noFPWD = true;
    let list = document.querySelectorAll("ul#steps li");
    // compute all the dates that are using the REC as a base
    for (var index = 0; index < list.length; index++) {
      let li = list[index];
      if (li.id === 'to-fpwd' || li.id === "fpwd"
          || li.id === "first-cfe" || li.id === "reference-draft") {
        li.setAttribute("hidden", "hidden");
      }
    }
    onpushstate();
  }
  function addFPWD() {
    trace("Add FPWD dates");
    config.noFPWD = false;
    let list = document.querySelectorAll("ul#steps li");
    // compute all the dates that are using the REC as a base
    for (var index = 0; index < list.length; index++) {
      let li = list[index];
      if (li.id === 'to-fpwd' || li.id === "fpwd"
          || li.id === "first-cfe" || li.id === "reference-draft") {
        li.removeAttribute("hidden");
      }
    }
    onpushstate();
  }
  function toggleFPWD(e) {
    if (disableChange) return;
    trace("Toggle noFPWD");
    if (e.target.checked && !config.noFPWD) {
      removeFPWD();
    } else if (!e.target.checked && config.noFPWD){
      addFPWD();
    }
  }
  function adjustDates(refInput) {
    trace("Adjust dates");
    let item = refInput;
    while (item.nodeName !== "LI") {
      item = item.parentNode;
      if (item === null) throw new Error("Invalid HTML structure");
    }
    clearLog();

    // adjust the reference input date
    let d;
    if (refInput.value === "") {
        return;
    } else {
      d = convertDate(refInput.value);
      if (!d.isValid()) {
        console.log("*ERROR* Invalid date!");
        return;
      }
    }
    clearLog();
    clearDates();
    updateItem(item, d, true);
    config.id = item.id;
    onpushstate();

    // all dates can be computed from the REC, so compute it
    // (REC uses the fpwd as a base)
    if (item.dataset.base === 'rec') {
      trace("Adjust REC date");
      let itemRec = document.getElementById("rec");
      let refItemDate = moment(item.momentDate);
      updateItem(itemRec, refItemDate.add(Math.abs(item.dataset.day), "days"), true);
    }
    tuneDates();
  }


  let disableChange = false;
  function changeInput(e) {
    if (disableChange) return;
    disableChange = true;
    adjustDates(e.target);
    disableChange = false;
  }

  let nodes = document.querySelectorAll("input[type=date]");
	for (var i = 0; i < nodes.length; i++) {
		nodes[i].onchange=changeInput;
	}

  document.querySelector("input[type=checkbox]").onchange = toggleFPWD;

   // browser history status push
	 function onpushstate() {
     let item = document.getElementById(config.id);
     let query = "";
     if (item !== null) {
       let date = item.momentDate;
       if (date !== undefined) {
         config.date = date.format("YYYY-MM-DD");
  		   query += item.id + "=" + date.format("YYYY-MM-DD");
       }
     }
     if (config.noFPWD) {
       if (query.length > 1) query += "&";
       query+= "noFPWD=true";
     }
     if (query.length > 1) {
      query = "?" + query;
     }
     window.history.pushState(config, config.id, query);
	  	 trace("pushed " +window.location.href);
   }

   // browser back and forward buttons
   window.onpopstate = function (e) {
		 let input = document.getElementById(e.state.id).querySelector("input");
     input.value = e.state.date;
     config.noFPWD = e.state.noFPWD;
     changeInput({ target: input });
     if (!config.noFPWD)
      document.querySelector("input[type=checkbox]").checked = true;
     else
      document.querySelector("input[type=checkbox]").checked = false;
  	 trace("popped " +window.location.href);
   }

   function displayMoratoria() {
    let list = document.getElementById("moratoria-list");
    let today = moment();
    for (var i = 0; i < moratoria.length; i++) {
      let range = moratoria[i];
      if (today.isSameOrBefore(range[1])) {
        let li = document.createElement("li");
        li.textContent = "From " + moment(range[0]).format('MMMM Do, YYYY')
          + " to " + moment(range[1]).format('MMMM Do, YYYY')
          + " : " + range[2];
          list.appendChild(li);
      }
    }
   }

  // initialization

  function initialize() {
     // #lazyweb
	   function getJsonFromUrl() {
       let query = location.search.substr(1);
       let result = {};
       query.split("&").forEach(function(part) {
        let item = part.split("=");
        if (item[1] !== undefined) {
          result[item[0]] = decodeURIComponent(item[1]);
        }
       });
      return result;
    }
    let init  = getJsonFromUrl();

    let foundARef = false;
    if (init["noFPWD"] === "true") {
        document.querySelector("input[type=checkbox]").checked = true;
        removeFPWD();
    }
    if (init["debug"] !== undefined) {
        trace = _trace;
    }
    for (var key in init) {
      if (!foundARef) {
	    	var item = document.getElementById(key);
      	if (item !== undefined && item !== null && item.nodeName === "LI") {
          let m = convertDate(init[key]);
          if (m.isValid()) {
            let input = item.querySelector("input");
            input.value = init[key];
            foundARef = true;
            changeInput({ target: input });
          } else {
            log("Invalid date in query parameters");
          }
        }
      }
    }
    displayMoratoria();
  }

  fetch("moratoria.json").then(res => res.json())
    .then(data => { moratoria = data })
    .catch(err => console.log(err))
    .then(r => initialize());
})();
