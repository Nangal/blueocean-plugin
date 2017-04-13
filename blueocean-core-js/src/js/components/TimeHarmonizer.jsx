/* eslint-disable */ //TODO: RM
import React, { Component, PropTypes } from 'react';
import { TimeManager } from '../utils/TimeManager';
import logging from '../logging';
import i18nTranslator from '../i18n/i18n';

// TODO: De-const this shit
const translateGLOBAL = i18nTranslator('blueocean-web');
const timeManager = new TimeManager();
const logger = logging.logger('io.jenkins.blueocean.core.TimeHarmonizer');

function translate(...args) { // TODO: RM
    try {
        let val = translateGLOBAL(...args);
        return val;
    } catch (e) {
        console.log('translate got exception', e);
    }
    return 'NUTS';
}

function jobStillActive(status) {
    switch (String(status).toUpperCase()) {
        case 'RUNNING':
        case 'PAUSED':
        case 'QUEUED':
            return true;
        default:
            return false;
    }
}

export class TimeHarmonizerUtil {
    // Construct with the owning component for access to props / context
    constructor(owner) {
        this.owner = owner;

        // TODO: I think we can splat this silly thing?
        const {startTime} = owner.props;
        this.durationMillis = startTime ? this.getTimes(owner.props).durationMillis : 0;
    }

    // Current server skew
    getSkewMillis = () => {
        const ctx = this.owner.context;
        return ctx && ctx.config ? ctx.config.getServerBrowserTimeSkewMillis() : 0;
    };

    getDuration = (result) => {
        const durationMillis = jobStillActive(result) ? this.durationMillis : this.getTimes().durationMillis;
        return durationMillis;
    };

    getTimes = (props) => { // TODO: Get rid of the props argument
        props = props || this.owner.props;
        const { result, startTime, durationInMillis, endTime } = props;
        if (!startTime) {
            return {};
        }
        // we need to make sure that we calculate with the correct time offset
        const harmonizeTimes = timeManager.harmonizeTimes({
            startTime,
            endTime,
            durationInMillis,
            isRunning: jobStillActive(result),
        }, this.getSkewMillis());
        return harmonizeTimes;
    };

    getI18nTitle = (result) => {
        const durationMillis = this.getDuration(result);
        const i18nDuration = timeManager.format(
            durationMillis,
            translate('common.date.duration.hint.format', { defaultValue: 'M [month], d [days], h[h], m[m], s[s]' }));

        const title = translate(`common.state.${result.toLowerCase()}`, { 0: i18nDuration });
        return title;
    };
}

export const TimeHarmonizer = ComposedComponent => {

    class NewComponent extends Component {

        componentWillMount() {
            this.timeHarmonizerUtil = new TimeHarmonizerUtil(this);
        }

        render() {
            const childProps = {
                ...this.props,
                ...this.state,
                getTimes: this.timeHarmonizerUtil.getTimes,
                getDuration: this.timeHarmonizerUtil.getDuration,
                getI18nTitle: this.timeHarmonizerUtil.getI18nTitle,
                isRunning: this.timeHarmonizerUtil.isRunning,
            };

            // create a composedComponent and inject the functions we want to expose
            return (<ComposedComponent {...childProps}/>);
        }
    }

    NewComponent.composedComponent = ComposedComponent;

    NewComponent.propTypes = {
        ...ComposedComponent.propTypes,
        result: PropTypes.string,
        startTime: PropTypes.string,
        endTime: PropTypes.string,
        durationInMillis: PropTypes.number,
    };

    NewComponent.contextTypes = {
        ...ComposedComponent.contextTypes,
        config: PropTypes.object.isRequired,
    };

    return NewComponent;
};


