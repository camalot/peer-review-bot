"use strict";
const express = require("express");
const bot = require("../bot");
const github = require("../github");
const debug = require("debug")("reviewbot:managed");
const router = express.Router();
const config = require("./managed.config.js");
const loginRoute = "/login";
const Promise = require("promise");
const _ = require("lodash");
const async = require("async");
const utils = require("../lib/utils");


let _render = (req, res, data) => {
	let dataObject = {
		repos: data,
		title: "Managed Repositories"
	};
	res.render("managed", dataObject);
};

router.get("/", utils.auth.isLoggedIn, (req, res, next) => {
	github.auth.isUserInOrganization(req.user).then(
		allowed => {
			if (!allowed) {
				console.log("not Authorized");
				let err = new Error("Not Authorized.");
				err.status = 403;
				return next(err);
			}
			let managedList = [];
			github.repos.getAll().then(
				repos => {
					try {
						async.each(
							repos,
							(item, nextRepo) => {
								// each
								github.webhooks.getAll(item).then(
									data => {
										let repo = data.repo;
										let hooks = data.hooks;
										github.webhooks.filterBotHooks(repo.name, hooks).then(
											filteredHooks => {
												async.each(
													filteredHooks,
													(hook, nextHook) => {
														// loop each filtered hook
														if (
															managedList.filter(t => {
																return t.repo.name === repo.name;
															}).length === 0
														) {
															managedList.push({
																hook: hook,
																repo: repo
															});
														}
														nextHook();
													},
													err => {
														// filtered.each done
														if (err) {
															console.error(err);
															nextRepo(err);
														}
														nextRepo();
													}
												);
											},
											err => {
												if (err) {
													console.error(err);
													nextRepo(err);
												}
											}
										);
									},
									err => {
										console.error(err);
										return next(err);
									}
								);
							},
							err => {
								// done repos.each
								if (err) {
									console.error(err);
									return next(err);
								}
								let sorted = _.orderBy(
									managedList,
									[
										o => {
											return o.repo.name.toLowerCase();
										}
									],
									["asc"]
								);
								_render(req, res, sorted);
							}
						);
					} catch (ex) {
						console.error(ex);
						return next(err);
					}
				},
				err => {
					console.error(err);
					return next(err);
				}
			);
		},
		err => {
			console.error(err);
			return next(err);
		}
	);
});

module.exports = router;
