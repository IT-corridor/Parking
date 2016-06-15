(function($, window) {
    var bar = new Nanobar({
    bg: "rgb(105, 141, 123)",
    target: $("div.bar-container")[0]
});
    $( document ).ready(function() {
    bar.go(15);
    bar.go(100);
});
}).call(this, jQuery, window);
