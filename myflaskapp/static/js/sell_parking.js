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

    jQuery.fn.address_submit = function(options){
        var endpoint = '/users/selling';
        var states = this.states = {
            'input': this.find('#user_input'),
            'validation': this.find('#user_validation'),
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
            var endpoint = '/users/selling';
            var payload = new Object();
            payload['picked'] = item.data()['geojsonKey'];
            payload['form_state'] = 'commit';
            // progress animations
            window.spinner.spin(window.spin_target);

            $.ajax({
                'url': endpoint,
                'data': jQuery.param(payload),
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(data, textStatus, jqXHR){
                    window.spinner.stop();
                    location.reload();
                }
            })
            evt.preventDefault();
            return false;
        };
        this.delete_spot = function(id) {
            var r = confirm("Are you sure to delete this parking spot?");
            if (r == false)
                return false;
            var endpoint = '/users/delete_spot';
            window.spinner.spin(window.spin_target);
            $.ajax({
                'url': endpoint,
                'data': {'id':id },
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(data, textStatus, jqXHR){
                    // window.spinner.stop();
                    location.reload();
                }
            })            
        };
        this.set_avail = function(check) {
            var endpoint = '/users/set_avail';
            window.spinner.spin(window.spin_target);
            $.ajax({
                'url': endpoint,
                'data': {'id':check.id, 'checked':check.checked },
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(data, textStatus, jqXHR){
                    window.spinner.stop();
                }
            })            
        };
        this.enable_update_price = function(id) {
            $('#price'+id).removeAttr('readonly');
            $('#price'+id).css('border', '0');
            $('#price'+id).focus();
        };
        this.update_price = function(obj, id) {
            var endpoint = '/users/update_price';
            window.spinner.spin(window.spin_target);
            $.ajax({
                'url': endpoint,
                'data': {'id':id, 'price':obj.value },
                'type': 'POST',
                'beforeSend': function(xhr) {
                    xhr.setRequestHeader('X-CSRFToken', $('meta[name="csrf-token"]').attr('content'))
                },
                'success': function(id, textStatus, jqXHR){
                    window.spinner.stop();
                    $('#price'+id).attr('readonly', true);
                }
            })            
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
        window.address_submit = $("#address_submit").address_submit({});
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
        window.spin_target = document.getElementById('main_body')
        window.spinner = new Spinner(window.spin_opts);        
    });
        var bar = new Nanobar({
        bg: "rgb(105, 141, 123)",
        target: $("div.bar-container")[0]
    });
        
        $(document).ajaxSend(function () {
        bar.go(15);
        }).ajaxComplete(function () {
        bar.go(100);
    });
        $( document ).ready(function() {
        bar.go(15);
        bar.go(100);
    });
})(jQuery);