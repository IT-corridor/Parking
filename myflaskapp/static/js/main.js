(function(awe){
    /* 
       Frame One, Two, and Three will be swapped out as the user progresses through 
        setting or updating an address. 
       Frame Four will be constant and update with the map when the user submits/updates a new
        address.
    */
    var TIMEOUT_MS = 200;

    String.prototype.format = function(params, opts) {
        /*
            Pythonic way of formating a string.
            ['awesome','${gravy}'].join(' ').format({'gravy':'sauce'}) # awesome sauce
        */
        var key, r, value;
        opts = opts || new Object();
        opts.head = opts.head || '${';
        opts.tail = opts.tail || '}';
        r = this;
        for (key in params) {
          value = params[key];
          r = r.split(new Array(opts.head, key, opts.tail).join('')).join(value);
        }
        return r;
     };
    jQuery.fn.mmp = function(options){
        /*
            Encapsolates the entire map in a javascript wrapper for easy getter/setter functionality. 
            setting origin, feature waypoints, and features are done via accessors that then 
            update the leaflet/mapbox map.

            This object is implemented in a singleton pattern.
        */
        L.mapbox.accessToken = options['key'] || 'pk.eyJ1Ijoiam9neW4iLCJhIjoiY2lsdHpvaGUzMDBpMHY5a3MxcDMycHltZSJ9.VhDkOW21B44br30e9Td3Pg';
        var mbc = function(elm){
            this.map = L.mapbox.map(elm.attr('id')) // or mapbox.k8xv42t9 this.map = L.mapbox.map(elm.attr('id'), 'mapbox.streets')
            .setView([48.447469, -123.350505], 12)
            .addControl(L.mapbox.geocoderControl('mapbox.places', {
              keepOpen: true
            }));
            this.map.scrollWheelZoom.enable();
            this.iconTmpl = function(locale, isDst=false, isMore=false){
                /* add marker to map with info.
                    isDst: true when the spot is destination
                    isMore: true when the spot is not in 3 closest spots
                */
                var iconUrl = isDst ? '/static/img/marker-dst.png' : '/static/img/marker.png';
                var className = isMore ? 'more_spots' : '';
                locale.setIcon(L.icon({
                    iconUrl: iconUrl,
                    iconSize: [50, 50],
                    iconAnchor: [28, 28],
                    popupAnchor: [0, -34],
                    className: className,
                }));
            };
            this.listings = [];
            this.styleLayer = L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v9').addTo(this.map)
            this.homebase = L.mapbox.featureLayer().addTo(this.map);
            this.locations = L.mapbox.featureLayer().addTo(this.map);
            this.driving = L.mapbox.featureLayer().addTo(this.map);
            this.geolocate = L.control.locate().addTo(this.map);
        };
        mbc.prototype.template = function(properties){
            return [
                '<div>',
                    '<h3>${p1} ${p9}</h3>',
                    '<div>${p5}</div>',
                    '<small class="quiet">${p8}</small>',
                '</div>'
            ].join('').format({
                'p5': properties.p5,
                'p1': properties.p1 == null ? 'Parking Spot' : properties.p1,
                'p9': properties.p9 == null ? '' : ' : $'+properties.p9,
                'p8': properties.p8 ? properties.p8 : ''
            });
        };
        mbc.prototype.setOrigin = function(origin){
            /*
                Sets the User's Origin POI.
            */
            this.origin = origin;
            this.homebase.setGeoJSON(origin);
            this.homebase.eachLayer(this.iconTmpl, true);
        }
        mbc.prototype.update = function(featureCollection){
            /*
                Updates the locations on the map and binds verious componets to the POIs.
            */
            var locale_map = this.locale_map = new Object();
            var self = this;
            this.locations.setGeoJSON(featureCollection);
            
            var dst_name = this.origin.properties.p0;
            var idx = 0;
            this.locations.eachLayer(function(locale){
                // add markers with corresponding info
                if(locale.feature.properties.p0 == dst_name)
                    // destination
                    self.iconTmpl(locale, true);
                else    
                    // spots checking more ones
                    self.iconTmpl(locale, false, idx > 5);
                locale.bindPopup(self.template(locale.feature.properties));
                locale_map[locale.feature.properties.p0] = locale;
                idx++;
            });
        };
        mbc.prototype.setFeatureLineMap = function(featureLineMap){
            /*
                Takaes the waypoint map for convenience later on...
            */
            this.featureLineMap = featureLineMap;
        };
        mbc.prototype.getLineItemOfFeatureByName = function(featureName){
            var result = undefined;
            $.each(this.featureLineMap, function(name, feature){
                if(name == featureName){
                    result = feature;
                    return feature;
                }
            })
            return result;
        };
        mbc.prototype.setFocus = function(featureName){
            /*
                navigate_to, sets the focus on this waypoint.
                It is called when the marker is clicked.
                It shows the popup dialog and center the map to the marker
            */
            var self = this;
            e = window.navigate_to.onclick;            
            $.each(this.locale_map, function(name, locale){
                if(name == featureName){
                    self.map.panTo(locale.getLatLng());
                    locale.openPopup();
                    self.driving.setGeoJSON(self.getLineItemOfFeatureByName(featureName));
                    return false
                }
            });
        };
        return new mbc(this);
    };
    jQuery.fn.update_listing = function(geojson){
        this.origin = geojson['origin'];
        this.pois = geojson['waypoints'];

        var generate_item_html = this.generate_item_html = function(entry, current, geojson_key){
            /*
                var what = true ? 'this': 'that' // will result in: what = this
                var what = false ? 'this': 'that' // will result in: what = that
            */
            return [
                '<div class="item ${extra_class}" data-name="${p0}" data-geojson-key="${geojson_key}">',
                    '<a href="#" onmouseover="window.navigate_to(event);" onclick="window.slide_down(event);" class="title">',
                        '<span> ${p1} </span>',
                        '<br/>',
                        '<strong>${p5}</strong>',
                        '<br/>',
                        '<small class="quite">${p8}</small>',
                    '</a>',
                    current ? '' : '<a href="/users/parking_sale?id=${p0}" class="btn btn-success btn-xs btn-buy" >Buy: <span class="btn-buy-price">$${p9}</span></a>',
                    current ? '<div> ${p6}&nbsp;-&nbsp;${p4}</div>' : '<div> ${p6}&nbsp;</div>',
                '</div>',
                current ? '<hr/>' : ''
            ].join('').format({
                'extra_class': current ? 'dst-address' : '',
                'p1': entry.properties.p1 == null ? '' : entry.properties.p1,
                'p5': entry.properties.p5,
                'p8': entry.properties.p8 ? entry.properties.p8 : '',
                'p6': entry.properties.p6,
                'p6': entry.properties.p6,
                'p4': entry.properties.p4,
                'p9': entry.properties.p9,
                'p0': entry.properties.p0,
                'geojson_key': '', //geojson_key,
            });
        };
        var featureCollection = {
            'type': 'FeatureCollection',
            'features': [],
        };
        var featureLineMap = new Object();
        var templates = [this.generate_item_html(geojson['origin'], true, false)];
        templates.push('<button type="button" class="btn btn-default btn-xs show-more" data-toggle="collapse" data-target="#more_spots" onclick="window.show_more(this);">Show more spots</button>');

        // add origin to feature collection too for tool tip
        featureCollection['features'].push(this.origin);
        
        $.each(this.pois, function(index, poi){            
            var feature = poi['address_b_id'];
            templates.push(generate_item_html(feature, false));
            // insert show/hide button after 3rd entry
            if(index == 4)
                templates.push('<div id="more_spots" class="collapse">');

            featureCollection['features'].push(feature);            
            featureLineMap[feature.properties.p0] = poi['mapbox_response'];
        });
        templates.push('</div>');
        this.html(templates.join(''));

        window.map.setFeatureLineMap(featureLineMap);
        window.map.setOrigin(geojson['origin']);
        window.map.update(featureCollection);
        return this
    };

    jQuery.fn.address_submit = function(options){
        var endpoint = '/users/parking/submit-address.json';
        var states = this.states = {
            'initial': this.find('#user_controls'),
            'input': this.find('#user_input'),
            'validation': this.find('#user_validation'),
            'finish': this.find('#done'),
        };
        
        var STATES = []; // List of states for convenince
        $.each(states, function(key, item){
            STATES.push(key);
        });
        var current_state = STATES[0]; // Intended State
        var loaded_state = undefined;  // State that is currently loaded into memory.
        this.get_active_elm = function(){
            var active = undefined;
            $.each(states, function(key, item){
                if (key == loaded_state){
                    active = item;
                    return
                }
            });
            return active;
        }
        this.commit = function(evt){
            var form = $(this.get_active_elm()).find('form[name=user_input_form]');
            var valid = true;
            $.each(form.find('input[required=required]'), function(index, elm){
                if($(elm).val() == '') {
                    valid = false;
                    console.log(elm)
                    $(elm).trigger('blur')
                    return false
                }
            });
            if(!valid){
                evt.preventDefault();
                return valid;
            }
            var payload = new Object();
            $.each(form.find('input'), function(index, elm){
                if($(elm).val())
                    payload[$(elm).attr('name')] = $(elm).val();
            });
            payload['form_state'] = 'validation';
            // progress animations
            window.spinner.spin(window.spin_target);
            $.ajax({
                'url': endpoint,
                // 'data': $('form[name=user_input_form]').serialize(),
                'data': jQuery.param(payload),
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(data, textStatus, jqXHR){
                    var items = ['<div class="item"> <strong> Validate your address from the list below. </strong> </div>']
                    $.each(data['features'], function(index, item){
                        // On the backend, the id of the address is being stored in the session
                        //  until the user confirms which address they want to use.

                        // The next step is to execute this.handle_validation(evt)
                        items.push(window.address_submit.generate_item_html(
                            item['place_name'], item['text'], item['id']));
                    });
                    window.address_submit.states['validation'].html(items.join(''));
                    window.address_submit.update_state('validation');
                    window.spinner.stop();
                }
            })
            evt.preventDefault();
            return false;
        };
        this.handle_validation = function(evt){
            // Captures an event from the browser with a targeted dom element.
            //  This targeted dom element is mined for a relationship to a .item class. The elm with this
            //  class retains the state of the address.id that dom element represents. The key is sent
            //  back to the server and cross referenced with what is saved in the flask sessions.
            var item = $(evt.target).parents('.item');
            var endpoint = '/users/parking/submit-address.json';
            var payload = new Object();
            payload['picked'] = item.data()['geojsonKey'];
            payload['form_state'] = 'commit';
            // progress animations
            window.spinner.spin(window.spin_target);
            bar.go(30);

            $.ajax({
                'url': endpoint,
                'data': jQuery.param(payload),
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(data, textStatus, jqXHR){
                    window.address_submit.update_state('finish');
                    $(".closest_coordinates").update_listing(data);
                    $('.more_spots').hide();
                    window.spinner.stop();
                    bar.go(50);
                    bar.go(100);
                    window.map.setFocus(window.map.origin.properties.p0);
                    location.reload();
                }
            })
            evt.preventDefault();
            return false;
        };
        this.update_state = function(new_state){
            var detected = false;
            $.each(states, function(key, item){
                if(new_state == key){
                    detected = true;
                    return
                }
            });
            if(!detected){
                console.debug("State doesn't exist.", new_state);
                return false;
            }
            current_state = new_state;
        };
        this.generate_item_html = function(address, cross_street, geojson_key){
            return [
                '<div class="item" data-geojson-key="${geojson_key}">',
                  '<a href="#" onclick="window.address_submit.handle_validation(event);" class="title">',
                    '<strong>${address}</strong>',
                    '<br/>',
                    '<small class="quite"> at ${cross_street}</small>',
                  '</a>',
                '</div>',
            ].join('').format({
                'address': address,
                'cross_street': cross_street,
                'geojson_key': geojson_key,
            });
        }

        var STATE_DELEGATES = {
            'initial': do_initial = function(){
                console.log('do_initial')
            },
            'input': do_input = function(){
                console.log('do_input');
            },
            'validation': do_validation = function(){
                console.log('do_validation')
            },
            'finish': do_finish = function(){
                console.log('do_finish')
            }
        }
        // Watch for State Changes
        var watcher = function(){
            $.each(states, function(key, item){
                if(key == loaded_state){
                    $(item).css({'display': ''});
                }else{
                    $(item).css({'display': 'none'});
                }
            })
            if(loaded_state != current_state){
                loaded_state = current_state;
                STATE_DELEGATES[loaded_state]();
            }
            setTimeout(watcher, TIMEOUT_MS);
        };
        setTimeout(watcher, 0);
        return this;
    };
    $(document).ready(function(){
        window.map = $("#map").mmp({}); // singleton
        window.address_submit = $("#address_submit").address_submit({});
        window.address_submit.update_state('initial');
        window.navigate_to = function(evt){
            var name = $(evt.target).parents('.item').data()['name'];
            window.map.setFocus(name);
            evt.preventDefault();
            return false;
        }
        window.slide_down = function(evt){
            var parent = $(evt.target).parents('.item');
            var addr1 = parent.find('strong');
            var addr2 = parent.find('div');
            var price = parent.find('.btn-buy-price');
            
            // console.log(addr2);
            $('#detail_panel .address').html(addr1.html()+', '+addr2.html());
            $('#detail_panel .price').html(price.html());
            $("#detail_panel").slideDown(300);
        }
        var $star_rating = $('.star-rating .fa');
        var SetRatingStar = function() {
            return $star_rating.each(function() {
                if (parseInt($star_rating.siblings('input.rating-value').val()) >= parseInt($(this).data('rating'))){
                    return $(this).removeClass('fa-star-o').addClass('fa-star');
                }else{
                    return $(this).removeClass('fa-star').addClass('fa-star-o');
                }
            });
        };
        $star_rating.on('click', function(){
            $star_rating.siblings('input.rating-value').val($(this).data('rating'));            
            var endpoint = '/users/_review_score';
            $.ajax({
                'url': endpoint,
                'data': {'rating': $star_rating.siblings('input.rating-value').val()},
                'type': 'POST',
                'beforeSend': function(xhr){
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                }
            })
            return SetRatingStar(); 
        });
        SetRatingStar();                
        window.show_more = function(obj){
            var title = $(obj).html();
            // 'more spots' have a class 'more_spots'
            if(title == 'Show more spots'){
                $(obj).html('Show less spots');
                $('.more_spots').show();
            }else{
                $(obj).html('Show more spots');
                $('.more_spots').hide();
                // remove the directions in case they are shown
                window.map.setFocus(window.map.origin.properties.p0);
            }            
        }
        // Init Listings
        var endpoint = '/users/parking/submit-address.json';
        $.ajax({
            'url': endpoint,
            'success': function(data, textStatus, jqXHR){
                $(".closest_coordinates").update_listing(data);
                // as default hide other spots
                $('.more_spots').hide();
            }
        });
        $('.close').click(function(){
            $('#detail_panel').hide();
        });
        // for animation
        window.spin_opts = {
              lines: 12 // The number of lines to draw
            , length: 10 // The length of each line
            , width: 6 // The line thickness
            , radius: 17 // The radius of the inner circle
            , speed: 1 // Rounds per second
            , shadow: false
            , opacity: 0.5            
        }
        window.spin_target = document.getElementById('mapbar')
        window.spinner = new Spinner(window.spin_opts);        
    });
        var bar = new Nanobar({
        bg: "rgb(105, 141, 123)",
        target: $("div.bar-container")[0]
    });
        
    $( document ).ready(function() {
        bar.go(15);
        bar.go(100);
    });

})(jQuery);
