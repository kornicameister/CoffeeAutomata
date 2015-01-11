(function (angular) {
    angular.module('coffeeAutomated', ['ngLocale', 'ui.router'])
        .factory('uiManager', function ($rootScope, $state) {
            var ui;
            $rootScope.ui = ui = {};
            return {
                toggleView : function (view) {
                    $state.go(view);
                },
                toggleError: function (err) {
                    if (!err) {
                        $rootScope.ui.error = undefined;
                    } else {
                        $rootScope.ui.error = {
                            msg  : err,
                            click: function () {
                                $rootScope.ui.error = undefined;
                            }
                        }
                    }
                },
                toggleMsg  : function (err) {
                    if (!err) {
                        $rootScope.ui.msg = undefined;
                    } else {
                        $rootScope.ui.msg = {
                            msg  : err,
                            click: function () {
                                $rootScope.ui.msg = undefined;
                            }
                        }
                    }
                }
            }
        })
        .factory('graphService', function ($rootScope, $q) {

            var graphSystem,
                nodesColorsMap = {
                    ACTIVE  : 'green',
                    INACTIVE: 'grey'
                },
                edgesColorsMap = {
                    ACTIVATED    : 'red',
                    NOT_ACTIVATED: 'blue'
                },
                intersect_line_line = function (p1, p2, p3, p4) {
                    var denom = ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
                    if (denom === 0) {
                        return false;
                    }

                    var ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
                    var ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

                    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
                        return false;
                    }
                    return arbor.Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
                },
                intersect_line_box = function (p1, p2, boxTuple) {
                    var p3 = {x: boxTuple[0], y: boxTuple[1]},
                        w = boxTuple[2],
                        h = boxTuple[3];

                    var tl = {x: p3.x, y: p3.y};
                    var tr = {x: p3.x + w, y: p3.y};
                    var bl = {x: p3.x, y: p3.y + h};
                    var br = {x: p3.x + w, y: p3.y + h};

                    return intersect_line_line(p1, p2, tl, tr) ||
                        intersect_line_line(p1, p2, tr, br) ||
                        intersect_line_line(p1, p2, br, bl) ||
                        intersect_line_line(p1, p2, bl, tl) ||
                        false
                };

            function getRenderer(canvas) {
                canvas = canvas[0];
                var ctx = canvas.getContext("2d"),
                    gfx = arbor.Graphics(canvas),
                    particleSystem;

                return {
                    init             : function (system) {
                        particleSystem = system;
                        particleSystem.screenSize(canvas.width, canvas.height);
                        particleSystem.screenPadding(80);
                        this.initMouseHandling();
                    },
                    initMouseHandling: function () {
                        // no-nonsense drag and drop (thanks springy.js)
                        var selected = null,
                            nearest = null,
                            dragged = null,
                            _mouseP = null;

                        // set up a handler object that will initially listen for mousedowns then
                        // for moves and mouseups while dragging
                        var handler = {
                            clicked: function (e) {
                                var pos = $(canvas).offset();
                                _mouseP = arbor.Point(e.pageX - pos.left, e.pageY - pos.top);
                                selected = nearest = dragged = particleSystem.nearest(_mouseP);

                                if (dragged.node !== null) {
                                    dragged.node.fixed = true;
                                }

                                $(canvas).bind('mousemove', handler.dragged);
                                $(window).bind('mouseup', handler.dropped);

                                return false
                            },
                            dragged: function (e) {
                                var pos = $(canvas).offset(),
                                    s = arbor.Point(e.pageX - pos.left, e.pageY - pos.top);

                                if (!nearest) {
                                    return;
                                }
                                if (dragged !== null && dragged.node !== null) {
                                    dragged.node.p = particleSystem.fromScreen(s);
                                }

                                return false
                            },

                            dropped: function () {
                                if (dragged === null || dragged.node === undefined) {
                                    return;
                                }
                                if (dragged.node !== null) {
                                    dragged.node.fixed = false;
                                }
                                dragged.node.tempMass = 50;
                                dragged = null;
                                selected = null;
                                $(canvas).unbind('mousemove', handler.dragged);
                                $(window).unbind('mouseup', handler.dropped);
                                _mouseP = null;
                                return false
                            }
                        };
                        $(canvas).mousedown(handler.clicked);
                    },
                    redraw           : function () {
                        var nodeBoxes = {};
                        gfx.clear();

                        ctx.fillStyle = "white";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        particleSystem.eachNode(function (node, pt) {
                            var label = node.data.label || "";
                            var w = ctx.measureText("" + label).width + 10;
                            if (!("" + label).match(/^[ \t]*$/)) {
                                pt.x = Math.floor(pt.x);
                                pt.y = Math.floor(pt.y)
                            } else {
                                label = null
                            }

                            // draw a rectangle centered at pt
                            if (node.data.color) {
                                ctx.fillStyle = node.data.color;
                            } else {
                                ctx.fillStyle = "rgba(0,0,0,.2)";
                            }
                            if (node.data.color == 'none') {
                                ctx.fillStyle = "white";
                            }

                            gfx.oval(pt.x - w / 2, pt.y - w / 2, w, w, {fill: ctx.fillStyle});
                            nodeBoxes[node.name] = [pt.x - w / 2, pt.y - w / 2, w, w];

                            // draw the text
                            if (label) {
                                ctx.font = "12px Helvetica";
                                ctx.textAlign = "center";
                                ctx.fillStyle = "white";
                                if (node.data.color == 'none') ctx.fillStyle = '#333333';
                                ctx.fillText(label || "", pt.x, pt.y + 4);
                                ctx.fillText(label || "", pt.x, pt.y + 4)
                            }
                        });


                        ctx.strokeStyle = "#cccccc";
                        ctx.lineWidth = 1;
                        ctx.beginPath();

                        particleSystem.eachEdge(function (edge, p1, p2) {
                            if (edge.source.data.alpha * edge.target.data.alpha == 0) {
                                return;
                            }
                            gfx.line(p1, p2, {stroke: "#b2b19d", width: 2, alpha: edge.target.data.alpha});

                            var weight = edge.data.weight,
                                color = edge.data.color,
                                tail = intersect_line_box(p1, p2, nodeBoxes[edge.source.name]),
                                head = intersect_line_box(tail, p2, nodeBoxes[edge.target.name]);

                            if (edge.data.directed) {
                                ctx.save();
                                {
                                    // move to the head position of the edge we just drew
                                    var wt = !isNaN(weight) ? parseFloat(weight) : ctx.lineWidth;
                                    var arrowLength = 6 + wt;
                                    var arrowWidth = 6 + wt;
                                    ctx.fillStyle = (color) ? color : ctx.strokeStyle;
                                    ctx.translate(head.x, head.y);
                                    ctx.rotate(Math.atan2(head.y - tail.y, head.x - tail.x));

                                    // delete some of the edge that's already there (so the point isn't hidden)
                                    ctx.clearRect(-arrowLength / 2, -wt / 2, arrowLength / 2, wt);

                                    // draw the chevron
                                    ctx.beginPath();
                                    ctx.moveTo(-arrowLength, arrowWidth);
                                    ctx.lineTo(0, 0);
                                    ctx.lineTo(-arrowLength, -arrowWidth);
                                    ctx.lineTo(-arrowLength * 0.8, -0);
                                    ctx.closePath();
                                    ctx.fill();
                                }
                                ctx.restore();
                            }
                        });
                    }
                }
            }

            return {
                init : function (graphMap, element) {
                    return $q(function (resolve, reject) {
                        try {
                            var sys = arbor.ParticleSystem(2000, 300, 0.5, true, 55, 0.002),
                                graph = {
                                    nodes: {},
                                    edges: {}
                                };

                            sys.renderer = getRenderer(element);

                            var nodes = graphMap.nodes,
                                routes;
                            _.forIn(nodes, function (node, from) {
                                graph.nodes[from] = {
                                    id   : node.id,
                                    color: node.id === 0 ? nodesColorsMap.ACTIVE : nodesColorsMap.INACTIVE,
                                    alpha: 1,
                                    label: node.label
                                };
                                routes = node.route || [];
                                if (routes.length) {
                                    var tmp = {};
                                    _.forEach(routes, function (to) {
                                        tmp[to] = {
                                            length  : Math.abs(node.id - nodes[from].id) + 2,
                                            directed: true,
                                            color   : edgesColorsMap.NOT_ACTIVATED,
                                            weight  : 8
                                        }
                                    });
                                    graph.edges[from] = tmp;
                                }
                            });

                            sys.graft(graph);

                            graphSystem = sys;

                            resolve(sys);
                        } catch (error) {
                            reject(error);
                        }
                    })
                },
                go   : function (from, to) {
                    return $q(function (resolve) {
                        from = graphSystem.getNode(from);
                        to = graphSystem.getNode(to);

                        from.data.color = nodesColorsMap.INACTIVE;
                        to.data.color = nodesColorsMap.ACTIVE;

                        var edge = graphSystem.getEdges(from, to)[0];
                        edge.data.color = edgesColorsMap.ACTIVATED;

                        resolve(to.name);
                    })
                },
                reset: function () {
                    return $q(function (resolve) {
                        graphSystem.eachNode(function (node) {
                            node.data.color = node.data.id > 0 ? nodesColorsMap.INACTIVE : nodesColorsMap.ACTIVE;
                        });
                        graphSystem.eachEdge(function (edge) {
                            edge.data.color = edgesColorsMap.NOT_ACTIVATED;
                        });
                        resolve();
                    })
                }
            }
        })
        .controller('FormController', function ($scope, $rootScope, uiManager) {
            // accessed from another parts
            $rootScope.automataSettings = {};

            // accessed as ng-model
            $scope.settings = {
                coffeePrice  : 0,
                denominations: []
            };

            $scope.denominations = [
                {value: 0.5, label: '50 gr'},
                {value: 1, label: '1 zł'},
                {value: 2, label: '2 zł'}
            ];
            $scope.denominationsAddVisible = false;
            $scope.predicate = 'value';

            $scope.save = function (settings) {

                if (settings.coffeePrice === 0) {
                    uiManager.toggleError('You must specify coffee price');
                    return false;
                }
                if ($scope.denominations.length === 0) {
                    uiManager.toggleError('No denominations found, add at least one');
                    return false;
                }

                var clone = _.clone(settings, true);
                clone.denominations = _.clone($scope.denominations, true);

                $rootScope.automataSettings = clone;

                $scope.settings = {};
                uiManager.toggleView('automata');
            };
            $scope.deleteDenomination = function (ds) {
                $scope.denominations = _.without($scope.denominations, ds);
            };
            $scope.saveDenomination = function () {
                var str = angular.element('#newDS').val();
                if (str && str.length) {
                    var val = parseFloat(str);
                    if (val === 0) {
                        uiManager.toggleError('You entered value 0, fix Your denomination value');
                    } else if (val < 0) {
                        uiManager.toggleError('Value ' + val + ' is invalid, cannot be negative');
                    } else {
                        $scope.denominations.push({
                            value: val,
                            label: (val < 1 ? val * 100 : val) + ' ' + (val < 1 ? 'gr' : 'zł')
                        });
                        $scope.denominationsAddVisible = false;
                        uiManager.toggleError();
                    }
                } else {
                    uiManager.toggleError('Please provide a value')
                }
            }

        })
        .controller('AutomataController', function ($scope, $log, $timeout, $q, uiManager, graphService, settings) {
            var finished = false,
                applyChangeState = function (name) {
                    var activeState = $scope.graph.nodes[name];
                    $scope.graph.state = {
                        activeState: name,
                        ref        : activeState,
                        routing    : getVerboseRouting(activeState)
                    };
                    $scope.selectiveRoutes = getRoutingOptions(activeState);
                },
                getVerboseRouting = function (state) {
                    var routes = state.route,
                        arr = [];

                    _.forEach(routes, function (route) {
                        arr.push($scope.graph.nodes[route].label);
                    });

                    return arr;
                },
                getRoutingOptions = function (state) {
                    var routes = state.route,
                        arr = [];

                    _.forEach(routes, function (route) {
                        arr.push({
                            to   : route,
                            label: $scope.graph.nodes[route].label
                        });
                    });

                    return arr;
                };

            $scope.semiAuto = settings.semiAuto;
            $scope.settings = settings;
            $scope.paymenentStatus = {
                price : settings.coffeePrice,
                paid  : 0,
                isPaid: settings.coffeePrice === 0
            };
            $scope.selectedRoute = undefined;
            $scope.selectiveRoutes = [];
            $scope.visitedNodes = [];
            $scope.actions = {
                putCoin: function (coin) {
                    $scope.paymenentStatus.paid += coin.value;
                    $scope.paymenentStatus.isPaid = $scope.paymenentStatus.paid >= $scope.paymenentStatus.price;
                    if ($scope.paymenentStatus.isPaid) {
                        $scope.paymenentStatus.change = Math.abs($scope.paymenentStatus.paid - $scope.paymenentStatus.price);
                    }
                    graphService.go($scope.graph.state.activeState, 'CHECK_OK').then(applyChangeState);
                },
                cancel : function () {
                    uiManager.toggleView('form');
                }
            };
            $scope.graph = {
                nodes: {
                    'START'        : {
                        id                 : 0,
                        label              : 'Start',
                        route              : ['CHECK_OK', 'CANCEL'],
                        onChange           : function () {
                            $log.debug('Entering START state');
                            if (finished) {
                                finished = false;
                                alert('You finished the automata');
                                $scope.paymenentStatus = {
                                    price : settings.coffeePrice,
                                    paid  : 0,
                                    isPaid: settings.coffeePrice === 0
                                }
                            } else {
                                if ($scope.semiAuto) {
                                    graphService.go('START', 'CHECK_OK').then(applyChangeState);
                                }
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve, reject) {
                                if (finished) {
                                    resolve();
                                } else {
                                    reject('Automata in progress...cannot go back to START')
                                }
                            })
                        }
                    },
                    'CHECK_OK'     : {
                        id                 : 1,
                        label              : 'Verifying...',
                        route              : ['PUT_COIN', 'MAKE_COFFEE'],
                        onChange           : function () {
                            $log.debug('Entering CHECK_OK state');
                            var to;
                            if ($scope.paymenentStatus.isPaid) {
                                $log.debug('Enough coins, move to MAKE_COFFEE');
                                to = 'MAKE_COFFEE';
                            } else {
                                $log.debug('Not enough coins, move to PUT_COIN');
                                to = 'PUT_COIN';
                            }
                            if ($scope.semiAuto) {
                                graphService.go('CHECK_OK', to).then(applyChangeState);
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            })
                        }
                    },
                    'PUT_COIN'     : {
                        id                 : 2,
                        label              : 'Put coin...',
                        route              : ['CHECK_OK', 'CANCEL'],
                        onChange           : function () {
                            $log.debug('Entering PUT_COIN state');
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            });
                        }
                    },
                    'MAKE_COFFEE'  : {
                        id                 : 3,
                        label              : 'Preparing a drink.',
                        route              : ['RETURN_CHANGE'],
                        onChange           : function () {
                            $log.debug('Entering MAKE_COFFEE state');
                            if ($scope.semiAuto) {
                                uiManager.toggleMsg('Sit tight while coffee is being prepared...');
                                $timeout(function () {
                                    graphService.go('MAKE_COFFEE', 'RETURN_CHANGE').then(applyChangeState);
                                    uiManager.toggleMsg('Coffee ready...');
                                }, 3000);
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            });
                        }
                    },
                    'RETURN_CHANGE': {
                        id                 : 4,
                        label              : 'Change...',
                        route              : ['FINISH'],
                        onChange           : function () {
                            $log.debug('Entering RETURN_CHANGE state');
                            if ($scope.semiAuto) {
                                if ($scope.paymenentStatus.change > 0) {
                                    uiManager.toggleMsg('You have been returned with ' + $scope.paymenentStatus.change);
                                }
                                $timeout(function () {
                                    graphService.go('RETURN_CHANGE', 'FINISH').then(applyChangeState);
                                }, 1000);
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            });
                        }
                    },
                    'CANCEL'       : {
                        id                 : 5,
                        label              : 'Canceled...',
                        route              : ['FINISH'],
                        onChange           : function () {
                            $log.debug('Entering CANCEL state');
                            alert('Cancel clicked, resetting automata and moving back to settings');
                            graphService.reset();
                            if ($scope.semiAuto) {
                                $timeout(function () {
                                    uiManager.toggleView('form');
                                }, 1000);
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            });
                        }
                    },
                    'FINISH'       : {
                        id                 : 6,
                        label              : 'Thank You...',
                        route              : ['START'],
                        onChange           : function () {
                            $log.debug('Entering FINISH state');
                            graphService.reset();
                            if ($scope.semiAuto) {
                                $timeout(function () {
                                    finished = true;
                                    graphService.go('FINISH', 'START').then(applyChangeState);
                                }, 1000);
                            }
                        },
                        isTransitionAllowed: function () {
                            return $q(function (resolve) {
                                resolve();
                            });
                        }
                    }
                }
            };

            graphService.init($scope.graph, angular.element('#graphViewport')).then(function () {
                // move to initial state o the start
                applyChangeState('START');
            });

            $scope.$watch('graph.state', function (state) {
                if (state) {
                    state.ref.onChange();
                }
            }, true);

            $scope.$watch('selectedRoute', function (route) {
                if (route) {
                    $scope.graph.nodes[route.to].isTransitionAllowed().then(
                        function ok() {
                            graphService.go($scope.graph.state.activeState, route.to).then(applyChangeState);
                        },
                        function error(msg) {
                            uiManager.toggleError(msg);
                        }
                    )
                }
            }, true);

        })
        .config(function ($stateProvider, $urlRouterProvider) {
            $urlRouterProvider.otherwise('/form');
            $stateProvider.state('form', {
                url        : '/form',
                templateUrl: 'tpls/form.html',
                controller : 'FormController'
            });
            $stateProvider.state('automata', {
                url        : '/automata',
                templateUrl: 'tpls/automata.html',
                controller : 'AutomataController',
                resolve    : {
                    settings: function ($rootScope) {
                        return $rootScope.automataSettings;
                    }
                }
            })
        })

}(angular));
