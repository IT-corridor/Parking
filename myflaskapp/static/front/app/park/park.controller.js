(function() {
    'use strict';

    angular.module('app.park', ['ngResource'])
        .controller('LoginSignupCtrl', ['$scope', '$auth', '$state', LoginSignupCtrl])
        .controller('BuyParkCtrl', ['$scope', '$window', 'Park', '$rootScope', '$location', '$log', '$q', '$timeout', BuyParkCtrl])
        .controller('SellParkCtrl', ['$scope', '$q', '$timeout', 'WizardHandler', 'Park', '$rootScope', SellParkCtrl])
        .controller('ParkTableController', ['$mdEditDialog', '$q', '$scope', '$timeout', 'Park', '$rootScope', ParkTableController]);

    function BuyParkCtrl($scope, $window, Park, $rootScope, $location, $log, $q, $timeout) {
        L.mapbox.accessToken = 'pk.eyJ1Ijoiam9neW4iLCJhIjoiY2lsdHpvaGUzMDBpMHY5a3MxcDMycHltZSJ9.VhDkOW21B44br30e9Td3Pg';
        $scope.map = L.mapbox.map('map', 'mapbox.streets')
            .setView([48.447469, -123.350505], 12)
            .addControl(L.mapbox.geocoderControl('mapbox.places', {
                keepOpen: true
            }));

        $scope.listings = [];
        $scope.styleLayer = L.mapbox.styleLayer('mapbox://styles/mapbox/streets-v9').addTo($scope.map)
        $scope.locations = L.mapbox.featureLayer().addTo($scope.map);
        $scope.driving = L.mapbox.featureLayer().addTo($scope.map);

        $scope.visible_more = true;
        $scope.edit_destination = false;
        $scope.destination = {};

        // for marker
        $scope.featureCollection = {
            'type': 'FeatureCollection',
            'features': [],
        };

        $scope.featureLineMap = {};

        $scope.data = Park.parkings({}, function(success) {
            $.each(success.waypoints, function(index, poi) {
                var feature = poi['address_b_id'];
                $scope.featureLineMap[feature.properties.p0] = poi['mapbox_response'];
            });

            $scope.show_more();
        });

        $scope.popup_template = function(properties) {
            var p5 = properties.p5;
            var p1 = properties.p1 == null ? 'Parking Spot' : properties.p1;
            var p9 = properties.p9 == null ? '' : ' : $' + properties.p9;
            var p8 = properties.p8 ? properties.p8 : '';

            return '<div><h3>' + p1 + p9 + '</h3><div>' + p5 + '</div><small class="quiet">' + p8 + '</small></div>';
        };

        $scope.show_more = function() {
            $scope.visible_more = !$scope.visible_more;

            $scope.featureCollection.features = [$scope.data.origin];
            $.each($scope.data.waypoints, function(index, poi) {
                if (!($scope.visible_more || index < 5))
                    return false;
                var feature = poi['address_b_id'];
                $scope.featureCollection['features'].push(feature);
            });

            // display markers
            $scope.locations.setGeoJSON($scope.featureCollection);
            $scope.locations.eachLayer(function(locale) {
                locale.bindPopup($scope.popup_template(locale.feature.properties));
            });
        }

        $scope.set_destination = function() {
            $scope.edit_destination = !$scope.edit_destination;
        }

        $scope.show_path = function(feature_id) {
            $scope.locations.eachLayer(function(locale) {
                if (locale.feature.properties.p0 == feature_id) {
                    $scope.map.panTo(locale.getLatLng());
                    locale.openPopup();
                    return false;
                }
            });

            $scope.driving.setGeoJSON($scope.featureLineMap[feature_id]);
        }

        $scope.park_detail = function(park) {
            $rootScope.park = park;
            $("#detail_panel").slideDown(300);
        }

        $rootScope.close_detail = function() {
            $("#detail_panel").hide();
        }

        $rootScope.reserve_park = function(park) {
            $rootScope.rsv_park = park;
            $("#detail_panel").hide();
            $location.path('/app2/reserve_park');
        }

        $rootScope.pre_charge = function() {
            // add more features here
            $location.path('/app2/pre_charge');
        }

        $scope.autocomplete = new google.maps.places.Autocomplete((document.getElementById('spot_address')), { types: ['geocode'] });

        $scope.modify_destination = function() {
            // google autocomplete does not bind itself.
            $scope.destination.address = angular.element(spot_address).val();
            Park.modify_destination($scope.destination,
                function(success) {
                    $scope.visible_more = true;
                    $scope.data = success;
                    $scope.featureLineMap = {};
                    $.each(success.waypoints, function(index, poi) {
                        var feature = poi['address_b_id'];
                        $scope.featureLineMap[feature.properties.p0] = poi['mapbox_response'];
                    });

                    $scope.show_more();
                    $scope.edit_destination = false;
                },
                function(error) {
                    $scope.error = error.data;
                }
            );

        }
    }

    function SellParkCtrl($scope, $q, $timeout, WizardHandler, Park, $rootScope) {        
        $scope.google_autocomplete = function() {
            $scope.autocomplete = new google.maps.places.Autocomplete((document.getElementById('spot_address')), { types: ['geocode'] });
        }

        $rootScope.load_table = false;
        // check only when the next button is clicked
        $scope.next_clicked = false;
        $scope.old_address = '';
        $scope.data = {};

        $scope.address_change = function() {
            $scope.next_clicked = false;
            $scope.error = false;
        }
        $scope.set_next_clicked = function() {
            $scope.next_clicked = true;
        }
        $scope.check_address = function() {
            if ($scope.autocomplete && $scope.next_clicked) {
                var address = angular.element(spot_address).val().trim();
                if (address && address != $scope.old_address) {
                    $scope.old_address = address;
                    console.log(address);
                    console.log('@@@@@@');
                    return true;
                    // Park.is_valid_address({'address': address}, 
                    //     function(success) {
                    //         return true;
                    //     },
                    //     function(error) {
                    //         $scope.error = 'Please provide a valid address!';
                    //     });
                } 
            } else {
                return false;
            }
        }

        $scope.phone_verifiable = false;
        $scope.phone_code = '';
        $scope.can_phone_exit = false;
        $scope.toggle_phone_verifiable = function() {
            $scope.phone_verifiable = true;
        }
        $scope.check_code = function(phone_code) {
            $scope.can_phone_exit = (phone_code == '3213');
        }

        $scope.spot_types = ['Residential', 'Office', 'Commercial'];
        $scope.spot_type = 'Residential';

        $scope.availability_types = ['Hourly', 'Monthly'];
        $scope.data.availability_type = 'Hourly';
        $scope.dow = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $scope.rangeSlider = [];

        for(var i = 0; i < $scope.dow.length; i++) {
            $scope.rangeSlider.push({ 
                minValue: 5, 
                maxValue: 21,
                title: $scope.dow[i],
                enabled: true,
                options: {
                    floor: 0,
                    disabled: false,
                    ceil: 23,
                    step: 1
                }
            });    
        }

        $scope.availability_type_change = function(availability_type) {
            for(var i = 0; i < $scope.dow.length; i++) {
                $scope.rangeSlider[i].options.disabled = !$scope.rangeSlider[i].enabled || availability_type != 'Hourly';
            }
        }

        $scope.set_time_enable = function(slider, time_enabled) {
            slider.options.disabled = !time_enabled;
        }

        $scope.add_spot = function() {
            $scope.data.address = $scope.old_address;

            console.log($scope.data);
            Park.add_spot($scope.data);
        }

        $scope.exitWithAPromise = function() {
            var d = $q.defer();
            $timeout(function() {
                $rootScope.$broadcast('load_table', true);
                d.resolve(true);
                // $rootScope.load_table = true;
            }, 5000);
            return d.promise;
        };

        $scope.finished = function() {
            alert("Wizard finished :)");
        };
        $scope.logStep = function() {
            console.log("Step continued");
        };
    }

    function ParkTableController($mdEditDialog, $q, $scope, $timeout, Park, $rootScope) {
        $scope.selected = [];
        $scope.limitOptions = [5, 10, 15];
        $scope.data = [];

        $scope.options = {
            rowSelection: true,
            multiSelect: true,
            autoSelect: false,
            decapitate: false,
            largeEditDialog: false,
            boundaryLinks: false,
            limitSelect: true,
            pageSelect: true
        };

        $scope.query = {
            order: 'mapbox_place_name',
            limit: 5,
            page: 1
        };

        $scope.$on('load_table', function (event, arg) { 
            if (arg) {
                $scope.data = Park.my_parkings();
            }
        });

        $scope.delete_spot = function(spot_id) {
            console.log(spot_id);
            Park.delete_spot({'spot_id': spot_id});
            for(var i = 0; i < $scope.data.length; i++)
                if ($scope.data[i].id == spot_id) {
                    $scope.data.slice(i, 1);
                    break;
                }
        }

        $scope.getTypes = function() {
            return ['Residential', 'Office', 'Commercial'];;
        };

        $scope.loadStuff = function() {
            $scope.promise = $timeout(function() {
                // loading
            }, 2000);
        }

        $scope.logItem = function(item) {
            console.log(item.name, 'was selected');
        };

        $scope.logOrder = function(order) {
            console.log('order: ', order);
        };

        $scope.logPagination = function(page, limit) {
            console.log('page: ', page);
            console.log('limit: ', limit);
        }
    }

    function LoginSignupCtrl($scope, $auth, $state) {

        $scope.signUp = function() {
            $auth
                .signup({ email: $scope.email, password: $scope.password })
                .then(function(response) {
                    $auth.setToken(response);
                    $state.go('secret');
                })
                .catch(function(response) {
                    $scope.error = true;
                    $scope.errorMessage = "Invalid username and/or password";
                })
        };

        $scope.login = function() {
            $auth
                .login({ email: $scope.email, password: $scope.password })
                .then(function(response) {
                    $auth.setToken(response);
                    $state.go('app.dashboard');
                })
                .catch(function(response) {
                    $scope.error = true;
                    $scope.errorMessage = "Invalid username and/or password";
                })
        };

        $scope.logout = function() {
            $auth.logout();
            $state.go("signin");
        };

        $scope.auth = function(provider) {
            $auth.authenticate(provider)
                .then(function(response) {
                    console.debug("success", response);
                    $state.go('secret');
                })
                .catch(function(response) {
                    console.debug("catch", response);
                })
        }
    }
})();
