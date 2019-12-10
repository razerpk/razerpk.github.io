let map = {}
let canvas
let MARKERS = []
let userMarker = []
let walkingPoints = {}
let userLocation = [29.7636, 62.6010]
let isLocation = false

const LatitudeInKm = 110.574
const LongitudeInKm = 111.320

let TRAVELED_DISTANCE = 0
let gameLoop
let gameTimeLoop
let expandTimeout
let changeVisionRangeTimeOut
let activeBoosters = 0
let gameTime = 0 //seconds
let boosterTime = 0 //seconds
let zoomOutTime = 0 //seconds
let boostersPicked = 0
let menuBoxVisible = false
let legalBoxVisible = false
let isAudioOn = true
let playedOOBSound = true
let expandedZoomLevel = 12.8
let currentZoomLevel = 15
let gameSizeOption = "medium"
let markerAmount = 20
let isExpandOn = false

// Settings for game
let VISION_RANGE = 0.15 //km
let PLAYAREA = 0.5 //distance to the edge of play area from center km
const MARKER_MIN_DISTANCE = 0.1 //km
const PICKUP_RADIUS = 0.05 //km
const DEFAULT_MAP_ZOOM = 15

const main = () => {
    canvas = document.getElementById('overlayCanvas')

    displayMap()
    addUiListeners()
    getLocation()
    createRadioInputs()
    
    drawCanvas()
    
    window.addEventListener('resize', function(){
        drawCanvas()
    })

    document.getElementById('gameButton').onclick = function(e){ gameButtonPressed() }
}

const gameButtonPressed = () => {
    if(isLocation) {
        currentZoomLevel = DEFAULT_MAP_ZOOM
        document.getElementById('gameButton').style.display = 'none'
        document.getElementById('textBox').style.display = 'none'
        document.getElementById('selectGameArea').style.display = 'none'
        document.getElementById('expand').style.display = 'block'
        startGame()
    } else {
        alert('Please turn on GPS/location and refresh the page')
        getLocation()
    }
}

const startGame = () => {

    textBoxPopUpMessage("Find the end point among other boosters", 5)
    setTimeout(() => {
        textBoxPopUpMessage("Good luck hunter!", 3)
    },5 * 1000)

    const { overpassArea, overpassAreaValues } = calculateOverpassBoundingBoxString(userLocation, PLAYAREA)

    addMarkersToMap(overpassArea, overpassAreaValues)
    drawPlayAreaBorders(overpassAreaValues)
    drawCanvas()

    gameTimeLoop = setInterval(() => {
        updateGameTimes()
    }, 1000)

    gameLoop = setInterval(() => {
        //console.log(currentZoomLevel)
        isMarkersOnUserRadius()
        if(isMarkerPickable()){
            drawCanvas()
        }
        arrowToNearestMarker()

        let playerOOB = outsideOfArea(overpassAreaValues, userLocation)
        // Play out of bounds only between set interval if player stays out of bounds
        if(playerOOB && playedOOBSound){
            textBoxPopUpMessage(`
            WARNING: out of bounds
            <br>There are no boosters out of bounds.
            `, 8) // visible 8 seconds

            playedOOBSound = false
            setTimeout(() => {
                playedOOBSound = true
            }, 35 * 1000)
            playAudio("OOB")
        }

        map.flyTo({
            center: userLocation,
            zoom: currentZoomLevel
        })
        
        userMarker[0]._lngLat.lng = userLocation[0]
        userMarker[0]._lngLat.lat = userLocation[1]

        // Creates polyline for user locations
        
        let path = walkingPoints.features[0].geometry.coordinates
        // add current userMarker location to walkingPoints array if userMarker has moved
        if (!isSameLocation(path[path.length-1],userLocation)) {
            walkingPoints.features[0].geometry.coordinates.push(userLocation)
            path = walkingPoints.features[0].geometry.coordinates
            // start calculating distance when player has moved
            if (path.length > 1)
                TRAVELED_DISTANCE += haversineDistance(path[path.length-2], path[path.length-1])

        }
        
        map.getSource('trace').setData(walkingPoints)

        updateActiveGameInfo()
    }, 500)
}

const displayMap = () => {
    let pageMap = document.getElementById("map")
    mapboxgl.accessToken = 'pk.eyJ1IjoiZXBlbGkiLCJhIjoiY2sydTVsdnRwMWU0YTNpcWI4bTRyY3Q5YiJ9.4PJtcpEKynaEHJk67Bz_Iw'

    map = new mapboxgl.Map({
        container: pageMap, // container id
        style: 'mapbox://styles/epeli/ck3yg5m3613sw1co7h6mpjhlh', // stylesheet location
        center: [29.7636, 62.6010], // starting position [lng, lat]
        zoom: DEFAULT_MAP_ZOOM, // zoom level for map
    })

    let geojson = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
            type: 'Point',
            coordinates: [29.7636, 62.6010],
            },
        },]
    }

    walkingPoints = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
            type: 'LineString',
            coordinates: [],
            },
        },]
    }

    map.on('load', () => {
        // add polyline starting point to map (user location)
        map.addSource('trace', { type: 'geojson', data: walkingPoints })
        map.addLayer({
            "id": "trace",
            "type": "line",
            "source": "trace",
            "paint": {
                "line-color": "red",
                "line-opacity": 0.75,
                "line-width": 5
            }
        })
    })
    
    // create a HTML element for userMarker
    const userM = addMarkerToMap(geojson.features[0].geometry.coordinates, 'userMarker')
    userMarker.push(userM)
}

// compares 2 locations. Same locations returns true
// else return false
const isSameLocation = (lastLocation, currentLocation) => {
    if (lastLocation === undefined)
        return false
    if (lastLocation[0] === currentLocation[0] &&
        lastLocation[1] === currentLocation[1])
        return true

    return false
}

const arrowToNearestMarker = () => {

    if (MARKERS.length === 0)
        return console.log('no markers')

    drawCanvas()
    let markerLoc = [MARKERS[0]._lngLat.lng, MARKERS[0]._lngLat.lat]
    let userLoc = [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]
    let closestDistance = haversineDistance(markerLoc, userLoc)

    let vector = kmVector(markerLoc, userLoc)
    let closestMarkerLoc = markerLoc

    // Find closest marker
    for (let i = 1; i < MARKERS.length; i++) {
        markerLoc = [MARKERS[i]._lngLat.lng, MARKERS[i]._lngLat.lat]
        let distance = haversineDistance(markerLoc, userLoc)

        if (distance < closestDistance) {
            closestMarkerLoc = markerLoc
            closestDistance = distance
            vector = kmVector(markerLoc, userLoc)
        }
    }

    document.getElementById('distToBooster').style.display = 'none'
    // Draw arrow only if marker far enough and map is not expanded
    if (closestDistance > 0.1 && !isExpandOn) {
        vector = normalizeVector(vector)    
        vector = scaleVector(vector, 20)
    
        drawArrow(userLoc, closestMarkerLoc, vector, closestDistance)
    }
}

const drawArrow = (userLoc, markerLoc, vector, distance) => {
    distanceM = Math.round(distance*1000, 0)
    console.log(distanceM);
    let x, y, endX, endY
    
    let sizeMultiplier = 3
    // Find arrows starting and end point
    if (userLoc[0] > markerLoc[0]){
        x = canvas.width / 2 - vector[0]
        endX = x - vector[0]*sizeMultiplier
    } else {
        x = canvas.width / 2 + vector[0]
        endX = x + vector[0]*sizeMultiplier
    }
    
    if (userLoc[1] > markerLoc[1]) {
        y = canvas.height / 2 + vector[1]
        endY = y + vector[1]*sizeMultiplier
    } else {
        y = canvas.height / 2 - vector[1]
        endY = y - vector[1]*sizeMultiplier
    }

    //line for the arrow
    let ctx = canvas.getContext("2d")
    ctx.beginPath()
    ctx.moveTo(x,y)
    ctx.lineTo(endX, endY)
    ctx.lineWidth = 5
    ctx.strokeStyle = "#fd8b21"
    ctx.closePath()
    ctx.stroke()
    
    // Show text for distance to closest marker
    showDistanceToBooster( (x+(endX-x)/2), (y+(endY-y)/2), distanceM )
    
    //the head of arrow
    //https://stackoverflow.com/questions/808826/draw-arrow-on-canvas-tag
    let startX = x, startY = y
    let angle
    let r = 10 //size

    ctx.beginPath()

    angle = Math.atan2(endY-startY, endX-startX)
    x = r*Math.cos(angle) + endX
    y = r*Math.sin(angle) + endY

    ctx.moveTo(x, y)

    angle += (1/3)*(2*Math.PI)
    x = r*Math.cos(angle) + endX
    y = r*Math.sin(angle) + endY

    ctx.lineTo(x, y)

    angle += (1/3)*(2*Math.PI)
    x = r*Math.cos(angle) + endX
    y = r*Math.sin(angle) + endY

    ctx.lineTo(x, y)

    ctx.closePath()
    ctx.fillStyle = "#fd8b21"
    ctx.fill()
}

// Distance in box on top of the arrow
const showDistanceToBooster = (x, y, dist) => {
    let distToBooster = document.getElementById('distToBooster')
    distToBooster.style.display = 'block'
    distToBooster.innerHTML =`${dist}m`
    
    distToBooster.style.left = `${x}px`
    distToBooster.style.top = `${y}px`

    distToBooster.style.marginLeft = `${distToBooster.offsetWidth*(-1)/2}px`
    distToBooster.style.marginTop = `${distToBooster.offsetHeight*(-1)/2}px`
}

const kmVector = (markerLoc,userLoc) => {
    kmX = Math.abs(lngToKm(markerLoc[0], markerLoc[1]) - lngToKm(userLoc[0], markerLoc[1]))
    kmY = Math.abs(latToKm(markerLoc[1]) - latToKm(userLoc[1]))
    return [kmX, kmY]
}

function scaleVector(vector, scaler){
    let newV=[
        vector[0]*scaler,
        vector[1]*scaler
    ]
    return newV;
}

function normalizeVector(vector){
    var magn=getMagnitude(vector);
    var newV=[
        vector[0]/magn,
        vector[1]/magn
    ];
    return newV;
}

function getMagnitude(vector){
    return Math.sqrt(vector[0]*vector[0]+vector[1]*vector[1]);
}

// Vision radius around player
const drawCanvas = (vision = VISION_RANGE) => {

    canvas.height = window.innerHeight
    canvas.width = window.innerWidth
 
    fillCanvas("black")
    let pixelInKm = kmDistancePerPixel(userLocation[1])

    // Don't draw unless game has started
    if(gameTime > 0)
        clearCircleArea(vision/pixelInKm)
}

const drawPlayAreaBorders = (overpassAreaValues) => {

    if (map.getSource('play-area')){
        map.removeLayer('area-boundary')
        map.removeSource('play-area')
    }

    let south = overpassAreaValues[0]
    let west = overpassAreaValues[1]
    let north = overpassAreaValues[2]
    let east = overpassAreaValues[3]

    map.addSource("play-area", {
        "type": "geojson",
        "data": {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                    [
                        [west[0], north[1]],
                        [west[0], south[1]],
                        [east[0], south[1]],
                        [east[0], north[1]],
                        [west[0], north[1]]
                    ]
                ]}
            }]
        }
    })

    map.addLayer({
        "id": "area-boundary",
        "type": "line",
        "source": "play-area",
        "paint": {
            "line-color": "#f7f300",
            "line-width": 2
        },
    })
}

const getLocation = () => {
    let geolocation = null
    if(window.navigator && window.navigator.geolocation){
        geolocation = window.navigator.geolocation
    }
    if(geolocation){
        geolocation.getCurrentPosition(success)
		
		// call success when the position changes
		userLocation = geolocation.watchPosition(success,null,{
			enableHighAccuracy: true,
			maximumAge: 1000
        });
		
    }else{
        isLocation = false
    }
}

const success = (position) => {
    if (!isLocation) {
        map.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: expandedZoomLevel
        })
        userMarker[0]._lngLat.lng = position.coords.longitude
        userMarker[0]._lngLat.lat = position.coords.latitude
    }

    userLocation = [position.coords.longitude, position.coords.latitude]
    
    isLocation = true
    return [position.coords.longitude, position.coords.latitude]
}

const updateGameTimes = () => {
    document.getElementById('gameTime').innerHTML = `${pad(parseInt(gameTime / 60))}:${pad(gameTime % 60)}`
    gameTime++
    let boosterTimeElem = document.getElementById('boosterTime')
    if(boosterTime > 0){
        boosterTimeElem.innerHTML =
            `${activeBoosters}<br>
            ${pad(parseInt(boosterTime / 60))}:${pad(boosterTime % 60)}`
        boosterTimeElem.style.display = 'block'
        boosterTime--
    }else if(activeBoosters === 0)
        boosterTimeElem.style.display = 'none'
    
    let expandTextCircle = document.getElementById('expandTextCircle')
    if (zoomOutTime > 0) {
        expandTextCircle.style.display = 'block'
        expandTextCircle.innerHTML = `
        <div id="expandTime">${pad(parseInt(zoomOutTime / 60))}:${pad(zoomOutTime % 60)}</div>`
        zoomOutTime--
    }
    else if (zoomOutTime === 0) 
        expandTextCircle.style.display = 'none'
}

const updateActiveGameInfo = () => {

    let activeGameInfo = document.getElementById('activeGameInfo')
    activeGameInfo.style.display = 'block'
    activeGameInfo.innerHTML =
    `
    Boosters:
    <br>${boostersPicked} / ${MARKERS.length+boostersPicked}
    <hr>
    Distance:
    <br>${TRAVELED_DISTANCE.toFixed(2)}km
    `
    
    let padding = 10
    // Base location for active game info
    let boosterTime = document.getElementById('playTime')
    let baseOffSet = boosterTime.offsetTop + boosterTime.offsetHeight

    if (activeBoosters === 0) {
        // Make sure that active booster info is not visible.
        // JS timer inaccuracy so this is needed since
        // there is multiple seperate timers going on.
        setTimeout(() => {
            activeGameInfo.style.top = `${baseOffSet+padding}px`
        }, 500)
        //activeGameInfo.style.top = `${baseOffSet+padding}px`
    } else {
        // Booster anmount and time visible -> 'push' active info down
        let playTime = document.getElementById('playTime')
        let offset = baseOffSet + playTime.offsetHeight
        activeGameInfo.style.top = `${offset}px`
    }
}

//Listeners for UI elements
const addUiListeners = () => {
    document.getElementById('copyright').onclick = function(e){ showLegalBox() }
    document.getElementById('menu').onclick = function(e){ showMenuBox() }
    // Hide menu and/or legal info if canvas is clicked
    canvas.onclick = function(e){
        hideMenuAndLegalIfVisible()
    }
    document.getElementById('expand').onclick = function(e){ expandMap() }
    document.getElementById('mapboxLogo').onclick = function(e){ return confirm("Are you sure you want to open link in a new tab?") }
}

const hideMenuAndLegalIfVisible = () => {
    if (menuBoxVisible)
        hideMenuBox()
    if (legalBoxVisible)
        hideLegalBox()
}

const showMenuBox = () => {
    menuBoxVisible = true
    let menuBox = document.getElementById('menuBox')
    let checked = ""
    if(isAudioOn)
        checked = "checked"

    menuBox.innerHTML =
    `
    <table id='menuTable'>
        <tr>
            <td>
                Sound
                <label class="switch">
                    <input id='audioChange' type="checkbox" ${checked}>
                    <span class="slider round"></span>
                </label>
            </td>
        </tr>
        <tr><td><button id='restartButton' onclick='endGameScreen(false)'>Reset game</button></td></tr>
        <tr><td><button onclick='showAbout()'>About</button></td></tr>
    </table>
    `
    // To change audio setting on click on the slider
    document.getElementById('audioChange').onclick = function(e){ changeAudioSetting() }

    // legalBox visible smoothly
    menuBox.style.opacity = 1
    menuBox.style.height = `auto`
    menuBox.style.width = `auto`

    // Don't cover game logo
    let gameLogo = document.getElementById('gameLogo')
    menuBox.style.maxWidth = `${gameLogo.offsetLeft - gameLogo.offsetWidth/2}px`
    
    // Smooth hiding of the copyright logo
    document.getElementById('menu').style.opacity = 0
}

const changeAudioSetting = () => {
    if(isAudioOn)
        isAudioOn = false
    else
        isAudioOn = true
}

const hideMenuBox = () => {
    menuBoxVisible = false
    let menuBox = document.getElementById('menuBox')
    menuBox.style.opacity = 0
    // Smooth fade for box
    setTimeout(() => {
        menuBox.style.height = 0
        menuBox.style.width = 0
        menuBox.innerHTML = ""
    }, 1 * 1000)
    // Smooth visibility for the menu
    document.getElementById('menu').style.opacity = 1
}

const showLegalBox = () => {
    legalBoxVisible = true
    let legalBox = document.getElementById('legalBox')
    legalBox.innerHTML = `
    <a target="_blank" class="legalLink" href="https://www.mapbox.com/about/maps/">© Mapbox</a>
    <br>
    <a target="_blank" class="legalLink" href="http://www.openstreetmap.org/copyright">© OpenStreetMap</a>
    <br>
    <a target="_blank" class="legalLink" href="https://www.mapbox.com/map-feedback/">Improve this map</a>
    </p>`

    // legalBox visible smoothly
    legalBox.style.opacity = 1
    legalBox.style.height = `auto`
    legalBox.style.width = `auto`
    
    // Confirmations for all the links
    let aElems = document.getElementsByTagName('a')
    for (let i = 0; i < aElems.length; i++)
        aElems[i].onclick = function() { return confirm("Are you sure you want to open link in a new tab?") }

    // Smooth hiding of the copyright logo
    document.getElementById('copyright').style.opacity = 0
}

// Smooth hiding of all elements
const hideLegalBox = () => {
    legalBoxVisible = false
    let legalBox = document.getElementById('legalBox')
    legalBox.style.opacity = 0
    // Smooth fade for box
    setTimeout(() => {
        legalBox.style.height = 0
        legalBox.style.width = 0
    }, 1 * 1000)
    // Smooth visibility for the copyright logo
    document.getElementById('copyright').style.opacity = 1
}

const expandMap = () => {
    
    currentZoomLevel -= DEFAULT_MAP_ZOOM - expandedZoomLevel
    document.getElementById('expand').style.display = 'none'
    isExpandOn = true
    zoomOutTime = 10
        
    setTimeout(() => {
        userMarker[0]._element.hidden = true
    }, 300)
    
    expandTimeout = setTimeout(() => {
        currentZoomLevel += DEFAULT_MAP_ZOOM - expandedZoomLevel
        document.getElementById('expand').style.display = 'block'
        userMarker[0]._element.hidden = false
        isExpandOn = false
    }, 10 * 1000)
}

const addMarkersToMap = (overpassArea, overpassAreaValues) => {

    let overpassQuery =
        `[timeout:60]
        [out:json]
        ;
        (
        way
            ["highway"="track"]
            (${overpassArea});
        way
            ["highway"="residential"]
            (${overpassArea});
        way
            ["highway"="footway"]
            (${overpassArea});
        way
            ["highway"="path"]
            (${overpassArea});
        way
            ["highway"="cycleway"]
            (${overpassArea});
        );
        >;
    out;`

    const OVERPASS_URL = `https://lz4.overpass-api.de/api/interpreter?data=${overpassQuery}`

    httpGetAsync(OVERPASS_URL, createMarkers)
    
    // create all markers and add them to map
    function createMarkers(jsonData){
        // randomize all elements in array
        let elements = shuffle(jsonData.elements)
    
        // Create amount many markers or as many as can be placed
        for (let i = 0; i < elements.length; i++) {
            // Check if marker is enough farm from other markers and not OOB
            if (positionIsGood(elements[i], overpassAreaValues) === true) {
                let marker = addMarkerToMap([elements[i].lon, elements[i].lat], 'marker')      
                marker.endPoint = false
                marker.superbooster = false
                marker._element.hidden = true
                MARKERS = [...MARKERS, marker]
    
                if (MARKERS.length === markerAmount) {
                    break
                }
            }
        }
        if (MARKERS.length === 0) {
            endGameScreen(false)
            alert('Not enough streets to place powerups')
        }
        // TODO REMOVE
        //let marker = addMarkerToMap([userMarker[0]._lngLat.lng + 0.001, userMarker[0]._lngLat.lat], 'marker')      
        //marker.endPoint = true
        //MARKERS = [...MARKERS, marker]
        //
        // Only add super boosters if game area is large or xl
        if(gameSizeOption == "large" || gameSizeOption == "XL")
            MARKERS.forEach(marker => Math.random() < 0.2 ? marker.superbooster = true : marker)

        MARKERS[Math.floor(Math.random()*MARKERS.length)].endPoint = true
        console.log('markers placed ', MARKERS.length)
    }
}

//is marker placeable on the map
const positionIsGood = (element, overpassAreaValues) => {
    let location = [element.lon, element.lat]
    
    // check if enough far from usermarker
    if (haversineDistance(location, [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]) < VISION_RANGE)
        return false

    // check if marker is outside of boundingBox
    if (outsideOfArea(overpassAreaValues, location) === true) 
        return false

    // check if enough far from every marker
    for (let i = 0; i < MARKERS.length; i++) {
        if (haversineDistance(location, [MARKERS[i]._lngLat.lng, MARKERS[i]._lngLat.lat]) < MARKER_MIN_DISTANCE) {
            return false
        }
    }

    return true
}

const outsideOfArea = (overpassAreaValues, location) => {
    let south = overpassAreaValues[0]
    let west = overpassAreaValues[1]
    let north = overpassAreaValues[2]
    let east = overpassAreaValues[3]
    
    if (location[1] < south[1] || location[1] > north[1]) {
        return true
    }
    if (location[0] < west[0] || location[0] > east[0]) {
        return true
    }
    return false
}

function haversineDistance(start,end) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(end[1] - start[1]);  // deg2rad below
    var dLon = deg2rad(end[0] - start[0]); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(start[1])) * Math.cos(deg2rad(end[1])) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d
}

function httpGetAsync(url, callback){
    let request = new XMLHttpRequest()

    request.open("GET", url, true)
    request.onreadystatechange = function() { 
        if (request.readyState == 4 && request.status == 200){
            callback(JSON.parse(this.response))
        }
    }
    request.send(null)
}

const kmToLat = km => km/LatitudeInKm 

const latToKm = lat => LatitudeInKm * lat

const kmToLng = (km, currLat) => km/(LongitudeInKm*Math.cos(deg2rad(currLat)))

const lngToKm = (lng, currLat) => (LongitudeInKm*Math.cos(deg2rad(currLat))) * lng

const deg2rad = (deg) => deg * (Math.PI/180)

// returns: 1 pixel as km
const kmDistancePerPixel = (lat) => {
    let hDistance = (40075016.686 * Math.cos(deg2rad(lat))) / (2 ** currentZoomLevel)
    return (hDistance / 512) / 1000
}

// Add marker to map
const addMarkerToMap = (location, clasName) => {
    let newLng = location[0]
    let newLat = location[1]
    let el = document.createElement('div')
    el.className = clasName
    let marker = new mapboxgl.Marker(el)
        .setLngLat([newLng, newLat])
        .addTo(map)

    return marker
}

const calculateOverpassBoundingBoxString = (center, size) => {
  
    //south, west, north, east <- overpass wants this
    let south, west, north, east
    let lngChange = kmToLng(size, center[1])
    let latChange = kmToLat(size) 
    
    south = center[1] - latChange
    west = center[0] - lngChange
    north = center[1] + latChange
    east = center[0] + lngChange

    let boundingBox = `${south},${west},${north},${east}`
    let boundingBoxValues = [[center[0], south], [west, center[1]], [center[0], north], [east, center[1]]]

    return {
        overpassArea: boundingBox, 
        overpassAreaValues: boundingBoxValues
    }
}

const clearCircleArea = (radius) => {

    const x = canvas.width/2
    const y = canvas.height/2
    let context = canvas.getContext("2d")
    context.beginPath()
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.clip()
    context.clearRect(x - radius - 1, y - radius - 1,
                      radius * 2 + 2, radius * 2 + 2)
    context.beginPath()
    context.strokeStyle = "rgb(253, 139, 33)"
    context.lineWidth = 4
    context.arc(x, y, radius, 0, 2 * Math.PI)
    context.stroke()
}

const fillCanvas = (color) => {
    let context = canvas.getContext("2d")
    context.globalAlpha = 0.6;
    context.fillStyle = color
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.globalAlpha = 1;
}

const shuffle = (array) => {
    for(var i = 0; i < array.length; i++){
        let randomIndex = Math.floor(Math.random() * array.length)
        let tmp = array[i]
        array[i] = array[randomIndex]
        array[randomIndex] = tmp
    }
    return array
}

const isMarkersOnUserRadius = () => {
    
    for (let i = 0; i < MARKERS.length; i++) {
        //Check only non-visible markers
        if (MARKERS[i]._element.hidden === true) { 
            // distance between usermarker, MARKERS[i]
            if (haversineDistance([MARKERS[i]._lngLat.lng, MARKERS[i]._lngLat.lat], [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]) < VISION_RANGE) {
                MARKERS[i]._element.hidden = false
                playAudio("DiscoverBooster")
            }
        }
    }
}

// TODO: END GAME
const isMarkerPickable = () => {
    let isMarkerOnRadius = false

    for (let i = 0; i < MARKERS.length; i++) {
        //Check only visible markers
        if (MARKERS[i]._element.hidden === false) {
            // distance between usermarker, MARKERS[i]
            if (haversineDistance([MARKERS[i]._lngLat.lng, MARKERS[i]._lngLat.lat], [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]) < PICKUP_RADIUS) {
                console.log('deleting marker ',  MARKERS[i])

                boostersPicked++
                isMarkerOnRadius = true
                // Update values in menu if visible
                if (menuBoxVisible)
                    showMenuBox()
       
                if (MARKERS[i].endPoint) {
                    playAudio("end")
                    MARKERS[i].remove()
                    MARKERS.splice(i, 1)
                    endGameScreen(true)
                } else {
                    //playAudio("YouGotABooster")
                    changeVisionRange(MARKERS[i])
                    
                    // Create message for booster pickup
                    let boosterMsg 
                    
                    if (MARKERS[i].superbooster){
                        playAudio("YouGotASuperBooster")
                        boosterMsg = `
                        You got a super booster
                        <br><br>
                        Vision radius grew 100 meters
                        `
                    } else {
                        playAudio("YouGotABooster")
                        boosterMsg = `
                        You got a booster
                        <br><br>
                        Vision radius grew 50 meters
                        ` 
                    }
                    textBoxPopUpMessage(boosterMsg, 6)

                    MARKERS[i].remove()
                    MARKERS.splice(i, 1)
                }
            }            
        }
    }
    return isMarkerOnRadius
}

const createRadioInputs = () => {
    let selectGameArea = document.getElementById('selectGameArea')
    selectGameArea.innerHTML = `
    Select game area!
    <br>
    <input onclick='changePlayArea(0.3, "small")' type="radio" name='area' value="small">Small<br>
    <input onclick='changePlayArea(0.4, "medium")' type="radio" name='area' value="medium" checked>Medium<br>
    <input onclick='changePlayArea(0.5, "large")' type="radio" name='area' value="large">Large<br>
    <input onclick='changePlayArea(0.6, "XL")' type="radio" name='area' value="xl">XL
    `
    let gameButton = document.getElementById('gameButton')

    // Values for location when space to display all content
    let gameAreaOffSet = gameButton.offsetTop
    let gameAreaWidth = selectGameArea.offsetWidth

    // Calculate max height for this area
    //let gameLogo = document.getElementById('gameLogo')
    //let gameLogoBottom = gameLogo.offsetTop + gameLogo.offsetHeight
    //let maxHeightForSelectGameArea = gameAreaOffSet - gameLogoBottom - (gameButton.offsetHeight/2)

    selectGameArea.style.marginLeft = `${gameAreaWidth*(-1)/2}px`
    //selectGameArea.style.maxHeight = `${maxHeightForSelectGameArea}px`
}

const changePlayArea = (areaSize, gameSize) => {
    PLAYAREA = areaSize
    gameSizeOption = gameSize

    switch(gameSizeOption){
        case "small":
            expandedZoomLevel = 13.4
            markerAmount = 10
            break;
        case "medium":
            expandedZoomLevel = 12.8
            markerAmount = 20
            break;
        case "large":
            expandedZoomLevel = 12.4
            markerAmount = 25
            break;
        case "XL":
            expandedZoomLevel = 12.1
            markerAmount = 30
            break;
    }
    if(isLocation){
        map.flyTo({
            center: userLocation,
            zoom: expandedZoomLevel
        })
    }
}

const showAbout = () => {
    hideMenuAndLegalIfVisible()
    alert(`
Gamegoal:
Find the end point among other boosters

Boosters give temporary bonuses for 60s:
- Booster: 50m vision boost
- Super: booster 100m vision boost

Arrow inside vision range shows distance and direction to closest booster

Expand button zooms out the map for 10 seconds - located at the bottom of screen

Game area sizes:
- Small: 600m x 600m
- Normal: 800m x 800m
- Large: 1000m x 1000m
- XL: 1200m x 1200m
`)
}

//arg: false if reset, true if end game
const endGameScreen = (endGame) => {

    hideMenuAndLegalIfVisible()

    // These 3 need to be here!
    clearInterval(expandTimeout)
    userMarker[0]._element.hidden = false
    clearInterval(changeVisionRangeTimeOut)

    currentZoomLevel = expandedZoomLevel
    map.flyTo({
        center: userLocation,
        zoom: currentZoomLevel
    })

    document.getElementById('gameButton').style.display = 'block'
    document.getElementById('selectGameArea').style.display = 'block'
    
    if(endGame){
        document.getElementById('textBox').style.display = 'block'
        let textBox = document.getElementById('textBox')
        textBox.innerHTML = `
        Congratulations hunter!<br>
        <br>Map size: ${gameSizeOption}
        <br>Total time: ${pad(parseInt(gameTime / 60))}:${pad(gameTime % 60)}
        <br>Boosters picked: ${boostersPicked}
        <br>Total travel length: ${TRAVELED_DISTANCE.toFixed(2)}km
        <br>Speed: ${(TRAVELED_DISTANCE/(gameTime/3600)).toFixed(2)}km/h
        `
        // Center textBox
        textBox.style.marginLeft = `${textBox.offsetWidth*(-1)/2}px`
    }

    TRAVELED_DISTANCE = 0
    gameTime = 0
    boosterTime = 0 //seconds
    boostersPicked = 0
    activeBoosters = 0
    zoomOutTime = 0
    isExpandOn = false
    MARKERS.map(marker => marker.remove())
    MARKERS = []
    VISION_RANGE = 0.15 //km
    walkingPoints.features[0].geometry.coordinates = []
    clearInterval(gameLoop)
    clearInterval(gameTimeLoop)
    document.getElementById('gameTime').innerHTML = `${pad(parseInt(gameTime / 60))}:${pad(gameTime % 60)}`
    document.getElementById('boosterTime').style.display = 'none'
    document.getElementById('distToBooster').style.display = 'none'
    document.getElementById('expand').style.display = 'none'
    document.getElementById('expandTextCircle').style.display = 'none'

    setTimeout(() => {
        document.getElementById('activeGameInfo').style.display = 'none'
    }, 500)
    
    drawCanvas(0)
}

// Change the radius of cirle and zoom level on marker pickup
const changeVisionRange = (marker) => {
    let visionBoost = 0.05
    let zoomBoost = 0.3
    if(marker.superbooster){
        visionBoost = 0.1
        zoomBoost = zoomBoost * 2
        console.log("YOU GOT SUPER BOOSTER")
    }
    VISION_RANGE += visionBoost
    currentZoomLevel -= zoomBoost
    boosterTime = 60
    activeBoosters++
    changeVisionRangeTimeOut = setTimeout(() => {
        VISION_RANGE -= visionBoost
        currentZoomLevel += zoomBoost
        drawCanvas()
        activeBoosters--
    }, 60 * 1000)
}

const pad = (val) => {
    let valString = val + "";
    if (valString.length < 2){
        return "0" + valString;
    } else {
        return valString;
    }
}

const playAudio = (filename) => {
    if (isAudioOn){
        let audio = new Audio(`./sounds/${filename}.mp3`)
        audio.loop = false
        audio.play()
    }
}

const textBoxPopUpMessage = (message, timer) => {
    document.getElementById('textBox').style.display = 'block'
    
    let textBox = document.getElementById('textBox')
    textBox.innerHTML = message

    setTimeout(() => {
        document.getElementById('textBox').style.display = 'none'
    }, timer * 1000)

    // Center textBox
    textBox.style.marginLeft = `${textBox.offsetWidth*(-1)/2}px`
}