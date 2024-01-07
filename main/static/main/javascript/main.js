var tabLinks = document.getElementsByClassName("about-tabs");
var tabContents = document.getElementsByClassName("tab-contents");

function selectTab(tabName){
    for(tabLink of tabLinks){
        tabLink.classList.remove("active-tab")
    }
    for(tabContent of tabContents){
        tabContent.classList.remove("active-content")
    }
    event.currentTarget.classList.add("active-tab")
    document.getElementById(tabName).classList.add("active-content")
}