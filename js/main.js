let clickLocationOnMap = []
let MARKERS = []
let userMarker = []
let walkingPoints = {}
let userLocation = [29.7636, 62.6010]
const LatitudeInKm = 110.574
const LongitudeInKm = 111.320
let map = {}
const MARKER_MIN_DISTANCE = 0.1 //km
const PICKUP_RADIUS = 0.120 //km 0.05
const ZOOM_LEVEL = 15
let VISION_RANGE = 0.15 //km

const main = async () => {
    await displayMap()
    await addMarkersToMap()
    await addUiListeners()
    await startGame()
}

const startGame = () => {
    let canvas = document.getElementById('overlayCanvas')

    drawVisionRange(canvas)

    window.addEventListener('resize', function(){
        drawVisionRange(canvas)
    })

    let gameLoop = setInterval(() => {
        isMarkersOnUserRadius()
        if (isMarkerPickable()) {
            drawVisionRange(canvas)
        }

        let newUserLocation = [userLocation[0] + 0.00005, userLocation[1] + 0.00005]
        userLocation = newUserLocation
        map.flyTo({center: newUserLocation})
        userMarker[0]._lngLat.lng = newUserLocation[0]
        userMarker[0]._lngLat.lat = newUserLocation[1]

        // Creates polyline for user locations
        walkingPoints.features[0].geometry.coordinates.push(newUserLocation)
        map.getSource('trace').setData(walkingPoints)

        setTimeout(() => {
            clearInterval(gameLoop)
        }, 7000)

    }, 100)
}

const drawVisionRange = (canvas) => {

    canvas.height = window.innerHeight
    canvas.width = window.innerWidth 
 
    fillCanvas(canvas, "black")
    let pixelInKm = kmDistancePerPixel(userLocation[1])
    clearCircleArea(canvas, canvas.width/2, canvas.height/2, VISION_RANGE/pixelInKm)
}

const displayMap = () => {
    let pageMap = document.getElementById("map")
    mapboxgl.accessToken = 'pk.eyJ1IjoiZXBlbGkiLCJhIjoiY2sydTVsdnRwMWU0YTNpcWI4bTRyY3Q5YiJ9.4PJtcpEKynaEHJk67Bz_Iw'

    // TODO use this on user location
    let loc = getLocation()

    map = new mapboxgl.Map({
        container: pageMap, // container id
        style: 'mapbox://styles/mapbox/dark-v10', // stylesheet location
        center: [29.7636, 62.6010], // starting position [lng, lat]
        zoom: ZOOM_LEVEL, // zoom level for map
        //pitch: 40, // pitch in degrees
    })
    
    //TODO take out //
    //map.scrollZoom.disable();
    // disable map rotation using right click + drag
    //map.dragRotate.disable();
 
    // disable map rotation using touch rotation gesture
    //map.touchZoomRotate.disableRotation();

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
            coordinates: [[29.7636, 62.6010]],
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

    // FOR DEBUGGING
    map.on('click', (e) => {
        clickLocationOnMap =  [e.lngLat.lng, e.lngLat.lat]
        map.flyTo({center: clickLocationOnMap})
        userMarker[0]._lngLat.lng = clickLocationOnMap[0]
        userMarker[0]._lngLat.lat = clickLocationOnMap[1]

        // Creates polyline for user locations
        walkingPoints.features[0].geometry.coordinates.push(clickLocationOnMap)
        map.getSource('trace').setData(walkingPoints)
    })
}

//Listeners for UI elements
const addUiListeners = () => {
    //let copyright = document.getElementById('copyright')
    document.getElementById('copyright').onclick = function(e){ showCopyrightBox() }
}

const showCopyrightBox = () => {
    console.log("GEGE")
    let legalBox = document.createElement('nav')
    legalBox.id = 'legalBox'
    legalBox.position = 'fixed'
    legalBox.top = '7vh'
    legalBox.left = '5vw'
    legalBox.right = '5vw'
    legalBox.height = '15vh'
    legalBox.backgroundColor = 'white'
    legalBox.border = '4px solid var(--borderColor)'
    legalBox.borderRadius = '5px'
}

const getLocation = () => {
    let geolocation = null
    if(window.navigator && window.navigator.geolocation){
        return window.navigator.geolocation.watchPosition(success)
    }
    if(geolocation){
        //geolocation.getCurrentPosition(success)
        //geolocation.watchPosition(success)
    }else{
        alert("Error with geolocation!")
    }
}

const addMarkersToMap = (amount = 20) => {

    // south, west, north, east
    const { overpassArea, overpassAreaValues } = calculateOverpassBoundingBoxString(userLocation, 1)

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
        );
        >;
    out;`

    const OVERPASS_URL = `https://lz4.overpass-api.de/api/interpreter?data=${overpassQuery}`

    httpGetAsync(OVERPASS_URL, createMarkers)
    
    // create all markers and add them to map
    function createMarkers(jsonData){
        // randomize all elements in array
        let elements = shuffle(jsonData.elements)

        // Create amount many markers or as many as outside MARKER_MIN_DISTANCE
        for (let i = 0; i < elements.length; i++) {
            if (positionIsGood(elements[i], overpassAreaValues) === true) {
                let marker = addMarkerToMap([elements[i].lon, elements[i].lat], 'marker')      
                marker.endPoint = false
                marker._element.hidden = true
                MARKERS = [...MARKERS, marker]
    
                if (MARKERS.length === amount) {
                    break
                }
            }
        }
        MARKERS[Math.floor(Math.random()*MARKERS.length)].endPoint = true
        console.log('markers placed ', MARKERS.length)
    }
}

const positionIsGood = (element, overpassAreaValues) => {
    let location = [element.lon, element.lat]
    
    // check if enough far from usermarker
    if (haversineDistance(location, [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]) < MARKER_MIN_DISTANCE)
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
    south = overpassAreaValues[0]
    west = overpassAreaValues[1]
    north = overpassAreaValues[2]
    east = overpassAreaValues[3]
    
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

const kmToLng = (km, currLat) => km/(LongitudeInKm*Math.cos(deg2rad(currLat)))

const deg2rad = (deg) => deg * (Math.PI/180)

const success = (position) => {
    console.log('object :', [position.coords.latitude, position.coords.longitude]);
    return [position.coords.latitude, position.coords.longitude]
}

// Distance per pixel math
// Stile = C ∙ cos(latitude) / 2 ^ zoomlevel
// Spixel = Stile / 256
// C = 40 075 016.686 m
// Mapbox GL–based libraries uses 512×512-pixel tiles by default
// returns: 1 pixel as km
const kmDistancePerPixel = (lat) => {
    let hDistance = (40075016.686 * Math.cos(deg2rad(lat))) / (2 ** ZOOM_LEVEL)
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

const clearCircleArea = (canvas, x, y, radius) => {
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

const fillCanvas = (canvas, color) => {
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
                let audio = new Audio('./sounds/bruh.mp3');
                audio.loop = false;
                audio.play();
            }
        }
    }
}

// TODO: GIVE SUPER POWERS
const isMarkerPickable = () => {
    let isMarkerOnRadius = false

    for (let i = 0; i < MARKERS.length; i++) {
        //Check only visible markers
        if (MARKERS[i]._element.hidden === false) {
            // distance between usermarker, MARKERS[i]
            if (haversineDistance([MARKERS[i]._lngLat.lng, MARKERS[i]._lngLat.lat], [userMarker[0]._lngLat.lng, userMarker[0]._lngLat.lat]) < PICKUP_RADIUS) {
                console.log('im here deleting marker ',  MARKERS[i])
                isMarkerOnRadius = true
                VISION_RANGE += 0.01
                MARKERS[i].remove()
                MARKERS.splice(i, 1)
                console.log(MARKERS.length);
            }            
        }
    }
    return isMarkerOnRadius
}