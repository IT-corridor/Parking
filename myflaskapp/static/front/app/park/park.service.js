(function () {
    'use strict';

    angular.module('app.park')
    .constant('source_path', 'http://localhost:5000/')
    .factory('Park', ['$resource', 'source_path', Park]);


    function Park($resource, source_path) {
        return $resource(source_path + 'users/:action/', {}, {
            parkings: {method:'GET', params:{action: 'buy_parking'}, responseType:'json'},
            modify_destination: {method:'POST', params:{action: 'buy_parking'}},
            my_parkings: {method:'GET', params:{action: 'sell_parking/my_spots'}, responseType:'json', isArray: true},
            is_valid_address: {method:'GET', params:{action: 'sell_parking/is_valid_address'}, responseType:'json'},
            add_spot: {method:'POST', params:{action: 'sell_parking/add_spot'}},
            delete_spot: {method:'PATCH', params:{action: 'sell_parking/delete_spot'}},
    	});
	}
})(); 