var updateAddress = {
    autocomplete: new google.maps.places.Autocomplete($("#address")[0], {
        types: ['geocode'],
        componentRestrictions: {country: 'ca'}
    }),
    event: function(){
        var self = this;
        google.maps.event.addListener(self.autocomplete, 'place_changed', function() {
            var place = self.autocomplete.getPlace(),
                address = place.address_components,
                streetAddress = '',
                city = '',
                state = '',
                zip = '',
                country = '';

            for (var i = 0; i < address.length; i++) {
                var addressType = address[i].types[0];

                if (addressType == 'subpremise') {
                    streetAddress += address[i].long_name + '/';
                }
                if (addressType == 'street_number') {
                    streetAddress += address[i].long_name + ' ';
                }
                if (address[i].types[0] == 'route') {
                    streetAddress += address[i].long_name;
                }
                if (addressType == 'locality') {
                    suburb = address[i].long_name;
                }
                if (addressType == 'administrative_area_level_1') {
                    state = address[i].long_name;
                }
                if (addressType == 'postal_code') {
                    zip = address[i].long_name;
                }
                if (addressType == 'country') {
                    country = address[i].long_name;
                }
            }

            // update the form
            setTimeout(function(){$('#address').val(streetAddress);},50);
            $('#city').val(suburb);
            $('#state').val(state);
        });

    }
};

updateAddress.event();
