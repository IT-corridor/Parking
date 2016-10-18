(function() {
    'use strict';

    angular.module('app.park', ['ngResource'])
        .controller('BuyParkCtrl', ['$scope', '$window', 'Park', '$rootScope', '$location', '$log', '$q', '$timeout', BuyParkCtrl])
        .controller('SellParkCtrl', ['$scope', '$q', '$timeout', 'WizardHandler', SellParkCtrl])
        .controller('ParkTableController', ['$mdEditDialog', '$q', '$scope', '$timeout', 'Park', ParkTableController]);

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

        $scope.address_autocompete = {
            'newState': newState,
            'querySearch': querySearch,
            'searchTextChange': searchTextChange,
            'selectedItemChange': selectedItemChange,
            'states': loadAll()
        };

        function loadAll() {
            var allStates = 'Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware,\
                            Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana,\
                            Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana,\
                            Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Carolina,\
                            North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina,\
                            South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia,\
                            Wisconsin, Wyoming';
            return allStates.split(/, +/g).map( function (state) {
                return {
                    value: state.toLowerCase(),
                    display: state
                };
            });
        }
        /**
         * Create filter function for a query string
         */
        function createFilterFor(query) {
            var lowercaseQuery = angular.lowercase(query);
            return function filterFn(state) {
                return (state.value.indexOf(lowercaseQuery) === 0);
            };
        }

        function querySearch (query) {
            var results = query ? $scope.address_autocompete.states.filter( createFilterFor(query) ) : $scope.address_autocompete.states,
                    deferred;
            if (true) {
                deferred = $q.defer();
                $timeout(function () { deferred.resolve( results ); }, Math.random() * 1000, false);
                return deferred.promise;
            } else {
                return results;
            }
        }
        function newState(state) {
            alert("Sorry! You'll need to create a Constituion for " + state + " first!");
        }

        function searchTextChange(text) {
            $log.info('Text changed to ' + text);
        }
        function selectedItemChange(item) {
            $log.info('Item changed to ' + JSON.stringify(item));
        }

    }

    function SellParkCtrl ($scope, $q, $timeout, WizardHandler) {
        $scope.canExit = false;
        $scope.stepActive = false;

        $scope.finished = function() {
            alert("Wizard finished :)");
        };
        $scope.logStep = function() {
            console.log("Step continued");
        };
        $scope.goBack = function() {
            WizardHandler.wizard().goTo(0);
        };
        $scope.exitWithAPromise = function() {
            var d = $q.defer();
            $timeout(function() {
                d.resolve(true);
            }, 1000);
            return d.promise;
        };
        $scope.exitToggle = function() {
            $scope.canExit = !$scope.canExit;
        };
        $scope.stepToggle = function() {
            $scope.stepActive = !$scope.stepActive;
        }
        $scope.exitValidation = function() {
            return $scope.canExit;
        };
    }    

    function ParkTableController($mdEditDialog, $q, $scope, $timeout, Park) {
        $scope.selected = [];
        $scope.limitOptions = [5, 10, 15];
        
        $scope.options = {
            rowSelection: true,
            multiSelect: true,
            autoSelect: true,
            decapitate: false,
            largeEditDialog: false,
            boundaryLinks: false,
            limitSelect: true,
            pageSelect: true
        };
        
        $scope.query = {
            order: 'name',
            limit: 5,
            page: 1
        };

        $scope.data = Park.my_parkings();

        $scope.editComment = function (event, dessert) {
            event.stopPropagation(); // in case autoselect is enabled
            
            var editDialog = {
                modelValue: dessert.comment,
                placeholder: 'Add a comment',
                save: function (input) {
                    if(input.$modelValue === 'Donald Trump') {
                        input.$invalid = true;
                        return $q.reject();
                    }
                    if(input.$modelValue === 'Bernie Sanders') {
                        return dessert.comment = 'FEEL THE BERN!'
                    }
                    dessert.comment = input.$modelValue;
                },
                targetEvent: event,
                title: 'Add a comment',
                validators: {
                    'md-maxlength': 30
                }
            };
            
            var promise;
            
            if($scope.options.largeEditDialog) {
                promise = $mdEditDialog.large(editDialog);
            } else {
                promise = $mdEditDialog.small(editDialog);
            }
            
            promise.then(function (ctrl) {
                var input = ctrl.getInput();
                
                input.$viewChangeListeners.push(function () {
                    input.$setValidity('test', input.$modelValue !== 'test');
                });
            });
        };
        
        $scope.toggleLimitOptions = function () {
            $scope.limitOptions = $scope.limitOptions ? undefined : [5, 10, 15];
        };
        
        $scope.getTypes = function () {
            return ['Available', 'Reserved', 'Sold'];
        };
        
        $scope.loadStuff = function () {
            $scope.promise = $timeout(function () {
                // loading
            }, 2000);
        }
        
        $scope.logItem = function (item) {
            console.log(item.name, 'was selected');
        };
        
        $scope.logOrder = function (order) {
            console.log('order: ', order);
        };
        
        $scope.logPagination = function (page, limit) {
            console.log('page: ', page);
            console.log('limit: ', limit);
        }
    }

})();
