** TODO **

-watchposition ottaa muuttujaan talteen locaatiot -> liikkuu marker.
-käy läpi marker taulukko ja kaho onko tyyppi lähellä eli aktvoi booster jne (distance vertailu min-distaneslla marker-user)

-UI (Bootstrap vai semantic ui?)
-lähestymisäänet (kun booster näköalueella)

=GEGE

-help button

-----------------------------------------------------------------------------------------------------------------------------

For testing purposes location of the user can be changed
by clickin desired location on the map: line 155 function on "main.js" file.
^ Only way to change location at the moment - change from GPS location is almost implemented.

We will use overpass API for picking powerup and end locations but that is still in to-do stage.

What else is missing:
- Vision radius to only show circle shaped area of the map around user marker
- Adding boosters functionality
- Adding proper UI
- Adding sounds for when booster is inside vision radius
    - Maybe adding tts for boosters and distanse to end location for complete offscreen gameplay

-----------------------------------------------------------------------------------------------------------------------------

Mapbox includes this built-in information button for your convenience. If you decide not to use it, you must include attribution on the map in a text format. The attribution must include © Mapbox as a link to https://www.mapbox.com/about/maps/, "© OpenStreetMap" as a link to http://www.openstreetmap.org/copyright, and "Improve this map" as a link to https://www.mapbox.com/map-feedback/. If you choose to use one of our Satellite styles, you must also include © DigitalGlobe as a link to https://www.digitalglobe.com/. Note that in the future, Mapbox may update the information on the attribution panel and require additional attribution to our suppliers.