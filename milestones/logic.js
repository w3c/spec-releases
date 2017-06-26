(function() {
  // For debugging
  var trace = function () {};

  function _trace(msg) {
	   console.log(msg);
  }

  if (window.location.href.includes("file:")) {
    trace = _trace;
  }

  function log(msg) {
    var pre = document.getElementById("log");
    var text = pre.textContent;
    if (text !== "") {
      text += "\n";
    }
    pre.textContent = text + msg;
  }

  function clearLog() {
    var pre = document.getElementById("log");
    pre.textContent = "";
  }

  function convertDate(dateInput) {
    return moment(dateInput + "T10:00:00-04:00"); // US/Eastern timezone; 
  }

  // For publication moratoria
  // this is populated later by fetching the moratoria.json
  var moratoria = [];

  function avoidMoratorium(date) {
    for (var i = 0; i < moratoria.length; i++) {
      var range = moratoria[i];
      if (date.isBetween(range[0], range[1], null, "[]")) {
        return false;
      }
    }
    return true;
  }

  // avoid Saturdays and Sundays
  function inWorkWeek(date) {
    var day = date.day();
    return (day !== 0 && day !== 6);
  }

  // only Tuesdays and Fridays, and avoid moratoria
  function forPublication(date) {
    var day = date.day();
    return ((day === 2 || day === 4)
            && avoidMoratorium(date));
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
      var originalDate = date;
      var publication = isPublication(item);
      var transition = isTransition(item);
      var msg = "";
      while((publication && !forPublication(date))
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
      var refItemDate = moment(item.momentDate);
      var diff = item.dataset.day - refItem.dataset.day;
      updateItem(item, refItemDate.add(diff, "days"), up);
  }

  // clear all dates
  function clearDates() {
    var list = document.querySelectorAll("ul#steps li");
    for (var index = 0; index < list.length; index++) {
      var li = list[index];
      li.momentDate = undefined;
      li.querySelector("span.date").textContent = "";
    }
  }

  // adjust all the dates according to the REC one
  function adjustAllDates()  {
    console.log("Adjust all dates");

    // update one Item
    function updateLI(li) {
        var refDate = document.getElementById(li.dataset.base).momentDate;
        if (refDate === undefined)
          throw new Error("Can't compute from base " + li.dataset.base);
        var refItemDate = moment(refDate);
        updateItem(li, refItemDate.add(li.dataset.day, "days"), false);      
    }
    var list = document.querySelectorAll("ul#steps li");
    // compute all the dates that are using the REC as a base
    for (var index = 0; index < list.length; index++) {
      var li = list[index];
      if (li.momentDate === undefined && li.dataset.base === 'rec') {
        updateLI(li);
      }
    }
    // compute all remaining dates
    for (var index = 0; index < list.length; index++) {
      var li = list[index];
      if (li.momentDate === undefined) {
        updateLI(li);
      }
    }
  }


  function adjustDates(refInput) {
    console.log("Adjust dates");
    var item = refInput;
    while (item.nodeName !== "LI") {
      item = item.parentNode;
      if (item === null) throw new Error("Invalid HTML structure");
    }
    clearLog();
    
    // adjust the reference input date
    var d;
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
    onpushstate(item);
    
    // all dates can be computed from the REC, so compute it
    // (REC uses the fpwd as a base)
    if (item.dataset.base === 'rec') {
      console.log("Adjust REC date");
      var itemRec = document.getElementById("rec");
      var refItemDate = moment(item.momentDate);
      updateItem(itemRec, refItemDate.add(Math.abs(item.dataset.day), "days"), true);
    }
    adjustAllDates();
  }


  var disableChange = false;
  function changeInput(e) {
    if (disableChange) return;
    disableChange = true;
    adjustDates(e.target);
    disableChange = false;
  }

  var nodes = document.querySelectorAll("input");
	for (var i = 0; i < nodes.length; i++) {
		nodes[i].onchange=changeInput;
	}

   // browser history status push
	 function onpushstate(item) {
     var date = item.momentDate;
     if (date !== undefined) {
  		 var query = "?" + item.id + "=" + date.format("YYYY-MM-DD");
       window.history.pushState({ id : item.id, date: date.format("YYYY-MM-DD") }, item.id, query);
	  	 trace("pushed " +window.location.href);
     }
   }

   // browser back and forward buttons
   window.onpopstate = function (e) {
		 var input = document.getElementById(e.state.id).querySelector("input");
     input.value = e.state.date;
     changeInput({ target: input });
  	 trace("popped " +window.location.href);
   }

  // initialization
	 
  function initialize() {
     // #lazyweb
	   function getJsonFromUrl() {
       var query = location.search.substr(1);
       var result = {};
       query.split("&").forEach(function(part) {
        var item = part.split("=");
        result[item[0]] = decodeURIComponent(item[1]);
       });
      return result;
    }
    var init  = getJsonFromUrl();

    for (var key in init) {
	  	var item = document.getElementById(key);
    	if (item !== undefined && item !== null && item.nodeName === "LI") {
        var m = convertDate(init[key]);
        if (m.isValid()) {
          var input = item.querySelector("input");
          input.value = init[key];
          changeInput({ target: input });
          break;
        } else {
          log("Invalid date in query parameters");
        }
      } else if (key === "debug") {
        trace = _trace;
      }
	  }
  }

  fetch("moratoria.json").then(res => res.json())
    .then(data => { moratoria = data })
    .then(r => initialize());
})();
