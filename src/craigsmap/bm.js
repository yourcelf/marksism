(function($) {

var stopped = false;
var entries = [];
var noAddress = [];
var map;
var geocoder;
var bounds;
var mapDiv = $("<div/>").attr({
    "id": "map"
}).css({
    "width": "50%",
    "height": "100%",
    "background-color": "red",
    "position": "fixed",
    "left": 0,
    "top": 0
});

var resultsDivHolder = $("<div/>").css({
    "width": "50%",
    "height": "100%",
    "overflow": "auto",
    "position": "fixed",
    "left": "50%",
    "top": 0,
    "background-color": "white"
});
var resultsDiv = $("<div/>").attr({
    "id": "results"
}).css({
    "padding": "1em"
}).appendTo(resultsDivHolder);

var loadingHolder = $("<div/>").css({
    "position": "absolute",
    "bottom": 0,
    "left": 0,
    "width": "100%", 
    "height": "2em",
    "font-weight": "bold",
    "text-align": "center",
    "color": "white",
    "overflow": "hidden",
    "z-index": 1
}).append("<div/>").css({
    "background-color": "black",
    "width": "100%",
    "height": "2em",
    "opacity": "0.8"
});
var noAddressLink = $("<a>").html("No address").click(function() {
    resultsDiv.html("");
    for (var i = 0; i < noAddress.length; i++) {
        var entry = noAddress[i];
        resultsDiv.append(
            $("<p>").append(
                $("<a>").attr("href", entry.href).html(entry.title),
                "(" + entry.loc + ")", 
                entry.hasPic ? " pic " : ""
            )
        );
    }
}).hide().css({
    "background-color": "black",
    "cursor": "pointer",
    "opacity": "0.8",
    "font-family": "sans-serif",
    "color": "white",
    "position": "absolute",
    "top": 0,
    "left": 100,
    "padding": "0.1em 1em",
    "z-index": 1
});

var loading = $("<span/>").appendTo(loadingHolder).html("Loading...");

var closeLink = $("<a>").attr("href", "").html("close (X)").css({
    "position": "absolute",
    "right": "1em",
    "top": 0,
    "font-size": "16px",
    "color": "black"
});

var overlay = $("<div/>").css({
    "position": "fixed",
    "height": "100%",
    "width": "100%",
    "top": 0,
    "z-index": 10,
    "overflow": "hidden",
    "left": 0
}).append(mapDiv, resultsDivHolder, closeLink, loadingHolder, noAddressLink);
$("body").append(overlay).css("overflow", "hidden");


function parseEntryLinks() {
    // Creates a data structure for each housing link.
    $("a").each(function(i, el) {
        var a = $(el);
        var href = a.attr("href");
        if (href && 
                href.indexOf("craigslist.org") != -1 && 
                href.split("/").pop().match(/^\d+\.html$/)) {
            entries.push({
                'title': a.text(),
                'href': href,
                'loc': $.trim(a.parent().children("font").text().replace(/[^a-z ]/gi, "")),
                'hasPic': a.parent().children("span").length > 0
            });
        }
    });
}

var entryIndex = 0;
function loadEntryPages() {
    var entry = entries[entryIndex];
    entryIndex++;
    loading.html("Loading (" + entryIndex + " / " +
                               entries.length + "), estimated time " + 
                 (1.25 * entries.length - entryIndex) + " seconds. ");
    loading.append(
        $("<a/>").attr("href", "#").html("stop").click(function() {
            stopped = true;
            return false;
        })
    );
    if (entryIndex < entries.length && !stopped) {
        $.ajax({
            url: entry.href, 
            type: 'GET',
            success: function(data) {
                setTimeout(loadEntryPages, 1000 + Math.random() * 500);
                var page = $(data);
                entry.page = page;
                page.find("a").each(function(i, el) {
                    var match = /http:\/\/maps.google.com\/\?q=(.*)/.exec($(el).attr("href"));
                    if (match) {
                        entry.address = unescape(match[1]).replace(/\+/g, " ");
                    }
                });
                if (!entry.address) {
                    noAddress.push(entry);
                }
                updateMap();
            },
            error: function(data) {
                entryIndex = entries.length;
            }
        });
    } else {
        loadingHolder.hide();
    }
}


var markers = {};
var selected = null;
function updateMap() {
    $.each(entries, function(i, entry) {
        if (entry.address) {
            if (!markers[entry.address]) {
                geocoder.geocode({
                    address: entry.address
                }, function(results, status) {
                    if (status == "OK") {
                        var latlng = results[0].geometry.location;
                        var marker = new google.maps.Marker({
                            position: latlng,
                            map: map,
                            title: entry.title
                        });
                        entry.latlng = latlng;
                        markers[entry.address] = marker;
                        google.maps.event.addListener(marker, 'click', function() {
                            showResults(entry.address);
                            if (selected) {
                                selected.setIcon("http://www.google.com/intl/en_us/mapfiles/ms/micons/red-dot.png");
                            }
                            selected = marker;
                            selected.setIcon("http://www.google.com/intl/en_us/mapfiles/ms/micons/green-dot.png");

                        });
                        bounds.extend(latlng);
                        map.fitBounds(bounds);
                    }
                });
            }
        }
    });
    if (noAddress.length > 0) {
        noAddressLink.show();
        noAddressLink.html("Results with no address: (" + noAddress.length + ")");
    }
}
function showResults(address) {
    resultsDiv.html("");
    for (var i = 0; i < entries.length; i++) {
        if (entries[i].address == address) {
            resultsDiv.append($("<h2>").html(entries[i].title));
            resultsDiv.append($("<p>").append($("<a>").attr("href", entries[i].href).html("link")));
            // selector doesn't seem to work here -- bad html?
            $(entries[i].page).each(function(i, el) {
                if ($(el).attr("id") == "userbody") {
                    resultsDiv.append(el);
                }
            });
        }
    }
}
// Hijack document.write so google doesn't bork the page.
var _write = document.write;
var _writeln = document.writeln;
document.writeln = document.write = function(s) {
    $("body").append(s);
};

var scriptInserted = false;
function loadMap() {
    if (!scriptInserted) {
        $("body").append($("<script>").attr({
            "type": "text/javascript",
            "src": "http://maps.google.com/maps/api/js?sensor=false"
        }));
        scriptInserted = true;
    }
    if (window.google != undefined && window.google.maps != undefined
            && window.google.maps.Map != undefined && window.google.maps.Geocoder != undefined) {
        map = new google.maps.Map(document.getElementById("map"), {
            center: new google.maps.LatLng(42.35, -71.05),
            zoom: 10,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        geocoder = new google.maps.Geocoder();
        bounds = new google.maps.LatLngBounds();
        loadEntryPages();
    } else {
        setTimeout(loadMap, 50);
    }
}

parseEntryLinks();
loadMap();

})(jQuery);
