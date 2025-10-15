var LitElement = LitElement || Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
var html = LitElement.prototype.html;

import { getTranslation, formatTranslation } from './locales/translations.js';
import { CARD_VERSION, CARD_INFO, CONSOLE_STYLE, SUPPORTED_SENSORS } from './constants.js';
import { styles } from './styles/styles.js';
import { cardContent } from './components/card-content.js';
import { getSensorConfig, getDisplayConfig, getColorConfig } from './configs/config.js';

console.info(
  `%c POOL-MONITORING-CARD %c ${CARD_VERSION} `,
  CONSOLE_STYLE.title,
  CONSOLE_STYLE.version,
);

/**
 * @class PoolMonitorCard
 * @extends {LitElement}
 * @description Custom Home Assistant card for monitoring pool sensors and displaying pool-related information
 * @property {Object} hass - Home Assistant instance
 * @property {Object} config - Card configuration
 * @version ${CARD_VERSION}
 */
export class PoolMonitorCard extends LitElement {
  static cardType = CARD_INFO.cardType;
  static cardName = CARD_INFO.cardName;
  static cardDescription = CARD_INFO.cardDescription;

  /**
   * @static
   * @returns {Object} Properties definition for the card
   */
  static get properties() {
    return {
      hass: {},
      config: {},
    };
  }

  static styles = styles;

  /**
   * @constructor
   */
  constructor() {
    super();
  }

  /**
   * @method render
   * @description Renders the pool monitor card content
   * @returns {TemplateResult} The rendered HTML template
   */
  render() {
    const config = this.getConfig();
    const data = this.processData();
    const generateContent = config.display.compact
      ? cardContent.generateCompactBody
      : cardContent.generateBody;

    // Vérifier si nous avons des données valides
    if (!data || Object.keys(data).length === 0) {
      return html` <div id="pool-monitor-card">
        <div class="warning-message">
          <ha-icon icon="mdi:alert"></ha-icon>
          <span>No valid sensor data available</span>
        </div>
      </div>`;
    }

    return html` <div id="pool-monitor-card">
      ${cardContent.generateTitle(config)}
      ${Object.values(data).map(sensorData => {
        if (sensorData?.invalid) {
          return html`
            <div class="warning-message">
              <ha-icon icon="mdi:alert"></ha-icon>
              <span
                >Sensor ${sensorData?.name || 'unknown'} is not supported. Please verify its
                configuration and ensure it is compatible with the card.</span
              >
            </div>
          `;
        } else if (sensorData?.value === null) {
          return html`
            <div class="warning-message">
              <ha-icon icon="mdi:alert"></ha-icon>
              <span
                >Entity ${sensorData?.entity || 'unknown'} could not be found. Please verify its
                name and ensure the entity is properly configured.</span
              >
            </div>
          `;
        }
        return generateContent(config, sensorData);
      })}
    </div>`;
  }

  /**
   * @method processData
   * @description Processes the sensor data for the card
   * @returns {Object} The processed sensor data
   */
  processData() {
    const data = {};
    const config = this.getConfig();

    Object.entries(config.sensors).forEach(([sensorType, sensorConfigs]) => {
      // Convertir en tableau si ce n'est pas déjà le cas (rétrocompatibilité)
      const sensorArray = Array.isArray(sensorConfigs) ? sensorConfigs : [sensorConfigs];

      sensorArray.forEach((sensor, index) => {
        const sensorKey = `${sensorType}_${index + 1}`;

        data[sensorKey] = this.calculateData(
          sensorType,
          sensor.title || this.getTranslatedText('sensor.' + sensorType),
          sensor.entity,
          sensor.min,
          sensor.max,
          sensor.setpoint,
          sensor.step,
          sensor.unit,
          sensor.icon,
          sensor.image_url,
          sensor.mode,
          sensor.min_limit,
          sensor.override_value,
          sensor.override,
          sensor.invalid,
        );
      });
    });

    return data;
  }

  /**
   * @method getTranslatedText
   * @description Retrieves a translated text based on the provided key and values
   * @param {string} key - The translation key
   * @param {Object} values - The values to replace in the translation
   * @returns {string} The translated text
   */
  getTranslatedText(key, values) {
    const lang = this.config?.display.language || 'en';
    const translation = getTranslation(lang, key);
    return formatTranslation(translation, values);
  }

  /**
   * @method calculateData
   * @description Calculates the data for a single sensor
   * @param {string} name - The sensor name
   * @param {string} title - The sensor title
   * @param {string} entity - The sensor entity
   * @param {number} entity_min - The minimum entity value
   * @param {number} entity_max - The maximum entity value
   * @param {number} setpoint - The setpoint value
   * @param {number} setpoint_step - The setpoint step value
   * @param {string} unit - The unit of measurement
   * @param {string} icon - The icon to display
   * @param {string} image_url - The image URL to display
   * @param {string} mode - The mode of the sensor
   * @param {number} min_limit - The minimum limit value
   * @param {number} override_value - The override value
   * @param {boolean} override - Whether to override the value
   * @param {boolean} invalid - Whether the sensor is invalid
   * @returns {Object} The calculated sensor data
   */
  calculateData(
    name,
    title,
    entity,
    entity_min,
    entity_max,
    setpoint,
    setpoint_step,
    unit,
    icon,
    image_url,
    mode,
    min_limit,
    override_value,
    override,
    invalid,
  ) {
    const newData = {};
    const config = this.getConfig();
    const defaultConfig = getSensorConfig(name) || {};

    newData.name = name;
    newData.invalid = invalid;
    newData.mode = mode;

    newData.title = config.display.show_names ? title : html`&nbsp;`;

    // Gestion des icônes et images pour chaque capteur
    newData.hide_icon = false;
    newData.is_mdi = false;
    if (!config.display.show_icons) {
      newData.hide_icon = true;
    } else {
      const sensorIcon = icon || '';
      const sensorImage = image_url || '';

      if (sensorIcon === 'hide') {
        newData.hide_icon = true;
      } else if (sensorImage) {
        newData.img_src = sensorImage;
      } else if (sensorIcon && typeof sensorIcon === 'string' && sensorIcon.startsWith('mdi:')) {
        newData.is_mdi = true;
        newData.mdi_icon = sensorIcon;
      } else {
        newData.img_src = `https://raw.githubusercontent.com/wilsto/pool-monitor-card/master/resources/${name}.png`;
      }
    }

    // Vérifier si l'entité existe
    if (!this.hass || !this.hass.states || !this.hass.states[entity]) {
      console.warn(`Entity not found: ${entity}`);
      newData.value = null;
      newData.entity = entity;
      return newData;
    }

    const entityDetails = this.hass?.entities ? this.hass.entities[entity] : {};
    const entityState = this.hass.states[entity];
    
    // Display Precision is managed on the entity itself in HA not in the attributes
    const precision = entityDetails?.display_precision ??
                     this.countDecimals(parseFloat(entityState.state));
    
    // Parse and format the value with the configured precision
    const rawValue = parseFloat(entityState.state);
    newData.value = isNaN(rawValue) ? null : Number(rawValue.toFixed(precision));
    newData.entity = entity;

    if (config.display.show_last_updated) {
      newData.last_updated = this.timeFromNow(entityState.last_updated);
    }

    // Utiliser l'unité de la configuration par défaut si non spécifiée
    newData.unit = config.display.show_units ? unit || defaultConfig.unit || '' : '';

    // Appliquer l'override après avoir lu la valeur du capteur
    if (override) {
      newData.value = override_value || defaultConfig.override;
    }

    // Vérifier les entités min/max
    newData.min_value =
      entity_min !== undefined &&
      this.hass.states[entity_min] &&
      !isNaN(parseFloat(this.hass.states[entity_min].state))
        ? parseFloat(this.hass.states[entity_min].state)
        : newData.value;

    newData.max_value =
      entity_max !== undefined &&
      this.hass.states[entity_max] &&
      !isNaN(parseFloat(this.hass.states[entity_max].state))
        ? parseFloat(this.hass.states[entity_max].state)
        : newData.value;

    // Utiliser les valeurs par défaut de la configuration si non spécifiées
    setpoint =
      setpoint !== undefined
        ? parseFloat(setpoint)
        : defaultConfig.setpoint !== undefined
          ? parseFloat(defaultConfig.setpoint)
          : newData.value;
    setpoint_step =
      setpoint_step !== undefined
        ? parseFloat(setpoint_step)
        : defaultConfig.step !== undefined
          ? parseFloat(defaultConfig.step)
          : 0.1;

    const countDecimals = Math.max(this.countDecimals(setpoint), this.countDecimals(setpoint_step));

    newData.setpoint = setpoint;

    // Calculate setpoint classes with min_limit consideration
    const minLimit = min_limit !== undefined ? Number(min_limit) : -Infinity;
    const sp_minus_2 = Math.max(minLimit, setpoint - 2 * setpoint_step);
    const sp_minus_1 = Math.max(minLimit, setpoint - setpoint_step);
    const sp = Math.max(minLimit, setpoint);
    const sp_plus_1 = Math.max(minLimit, setpoint + setpoint_step);
    const sp_plus_2 = Math.max(minLimit, setpoint + 2 * setpoint_step);

    newData.setpoint_class = [
      sp_minus_2.toFixed(countDecimals),
      sp_minus_1.toFixed(countDecimals),
      sp.toFixed(countDecimals),
      sp_plus_1.toFixed(countDecimals),
      sp_plus_2.toFixed(countDecimals),
    ];

    newData.separator = config.display.show_labels ? '-' : '';
    newData.color = 'transparent';

    // Ensure value respects min_limit
    if (newData.value !== null) {
      newData.value = Math.max(minLimit, newData.value);
    }

    if (mode === 'heatflow') {
      // Three-level gradient for heatflow mode
      if (Number(newData.value) < Number(newData.setpoint_class[1])) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.1') : '';
        newData.color = config.colors.cool;
      } else if (
        Number(newData.value) >= Number(newData.setpoint_class[1]) &&
        Number(newData.value) < Number(newData.setpoint_class[3])
      ) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.3') : '';
        newData.color = config.colors.low;
      } else {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.5') : '';
        newData.color = config.colors.warn;
      }
    } else {
      // Six-level gradient for default mode
      if (Number(newData.value) < Number(newData.setpoint_class[0])) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.1') : '';
        newData.color = config.colors.warn;
      } else if (
        Number(newData.value) >= Number(newData.setpoint_class[0]) &&
        Number(newData.value) < Number(newData.setpoint_class[1])
      ) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.2') : '';
        newData.color = config.colors.low;
      } else if (
        Number(newData.value) >= Number(newData.setpoint_class[1]) &&
        Number(newData.value) < Number(newData.setpoint_class[2])
      ) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.3') : '';
        newData.color = config.colors.normal;
      } else if (
        Number(newData.value) >= Number(newData.setpoint_class[2]) &&
        Number(newData.value) < Number(newData.setpoint_class[3])
      ) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.4') : '';
        newData.color = config.colors.normal;
      } else if (
        Number(newData.value) >= Number(newData.setpoint_class[3]) &&
        Number(newData.value) < Number(newData.setpoint_class[4])
      ) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.5') : '';
        newData.color = config.colors.low;
      } else if (Number(newData.value) >= Number(newData.setpoint_class[4])) {
        newData.state = config.display.show_labels ? this.getTranslatedText('state.6') : '';
        newData.color = config.colors.warn;
      }
    }
    newData.progressClass = name === 'temperature' ? 'progress-temp' : 'progress';

    newData.pct = Math.max(
      0,
      Math.min(
        98.5,
        (Math.max(0, newData.value - (setpoint - 3 * setpoint_step)) / (6 * setpoint_step)) *
          0.85 *
          100 +
          15,
      ),
    ).toFixed(0);
    newData.pct_min = Math.max(
      0,
      Math.min(
        98.5,
        (Math.max(0, newData.min_value - (setpoint - 3 * setpoint_step)) / (6 * setpoint_step)) *
          0.85 *
          100 +
          15,
      ),
    ).toFixed(0);
    newData.pct_max = Math.max(
      0,
      Math.min(
        98.5,
        (Math.max(0, newData.max_value - (setpoint - 3 * setpoint_step)) / (6 * setpoint_step)) *
          0.85 *
          100 +
          15,
      ),
    ).toFixed(0);
    newData.pct_marker = newData.value > newData.setpoint ? newData.pct - 12 : newData.pct - 5;
    newData.side_align = newData.value > setpoint ? 'right' : 'left';
    newData.pct_cursor =
      newData.value > setpoint ? 100 - parseFloat(newData.pct) : parseFloat(newData.pct) - 2;
    newData.pct_state_step =
      newData.value > setpoint ? 105 - parseFloat(newData.pct) : parseFloat(newData.pct) + 5;
    newData.pct_min =
      newData.value > setpoint
        ? 100 - parseFloat(newData.pct_min)
        : parseFloat(newData.pct_min) - 2;
    newData.pct_max =
      newData.value > setpoint
        ? 100 - parseFloat(newData.pct_max)
        : parseFloat(newData.pct_max) - 2;

    return newData;
  }

  /**
   * @method countDecimals
   * @description Counts the number of decimal places in a number
   * @param {number} number - The number to analyze
   * @returns {number} The number of decimal places (0 if integer or invalid)
   */
  countDecimals(number) {
    if (number === undefined || number === null) {
      return 0;
    }
    if (Math.floor(number) === number) {
      // si c'est un nombre entier
      return 0;
    }
    const str = number.toString();
    if (str.includes('.')) {
      return str.split('.')[1].length || 0;
    }
    return 0;
  }

  /**
   * @method timeFromNow
   * @description Calculates the time from now for a given date
   * @param {string} dateTime - The date and time to calculate from
   * @returns {string} The time from now
   */
  timeFromNow(dateTime) {
    const date = new Date(dateTime);
    const diff = Date.now() - date.getTime();

    const t = (key, n) => {
      const translationKey = n === 1 ? 'time' : 'time_plural';
      const values = { [key]: n };
      return this.getTranslatedText(`${translationKey}.${key}`, values);
    };

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return t('seconds', 0);
    if (minutes < 60) return t('minutes', minutes);
    if (hours < 24) return t('hours', hours);
    return t('days', days);
  }

  /**
   * @method getConfig
   * @description Retrieves the card configuration
   * @returns {Object} The card configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * @method setConfig
   * @description Sets the card configuration
   * @param {Object} config - The new card configuration
   */
  setConfig(config) {
    // Utiliser la configuration par défaut de config.js
    const defaultConfig = {
      display: getDisplayConfig(),
      colors: getColorConfig(),
    };

    // Merge avec la configuration utilisateur
    const newConfig = {
      ...config,
      display: {
        ...defaultConfig.display,
        ...(config.display || {}),
      },
      colors: {
        ...defaultConfig.colors,
        ...(config.colors || {}),
      },
      // Créer une copie profonde de la configuration des sensors
      sensors: {},
    };

    if (!config.sensors) {
      console.warn(`Legacy configuration detected, please move sensors under "sensors" key`, {
        config,
      });
      throw new Error(
        'Legacy configuration detected. Please update your setup to define all sensors under the "sensors" key as required by the version 2.0 of the card.',
      );
    }

    // Validation et transformation des capteurs
    Object.entries(config.sensors).forEach(([sensorType, sensorConfig]) => {
      // Obtenir la configuration par défaut pour ce type de capteur
      const defaultSensorConfig = getSensorConfig(sensorType);

      // Convertir en tableau si ce n'est pas déjà le cas (rétrocompatibilité)
      const sensorArray = Array.isArray(sensorConfig) ? [...sensorConfig] : [{ ...sensorConfig }];

      if (sensorArray.length === 0) {
        throw new Error(`Empty sensor array for ${sensorType}`);
      }

      // Fusionner les valeurs par défaut pour chaque capteur du tableau
      const mergedSensorArray = sensorArray.map(sensor => ({
        ...defaultSensorConfig, // Valeurs par défaut
        ...sensor, // Configuration utilisateur (écrase les valeurs par défaut)
        nameDefinedByUser: !!sensor.name, // Ajoute un boolean si name défini par l'utilisateur
      }));

      mergedSensorArray.forEach((sensor, index) => {
        if (!sensor.entity) {
          throw new Error(`Missing entity for ${sensorType}[${index}]`);
        }

        // Si un nom est configuré, l'ajouter au titre
        if (sensor.nameDefinedByUser) {
          sensor.title = sensor.name;
        }

        // Vérifier si le sensor est supporté
        if (!SUPPORTED_SENSORS.includes(sensorType)) {
          console.warn(`Unsupported sensor type: ${sensorType}`, {
            sensorType,
            supportedSensors: SUPPORTED_SENSORS,
            config: config,
            sensorConfig: sensor,
          });
          sensor.invalid = true;
        } else {
          sensor.invalid = false;
        }
      });

      // Stocker le tableau de capteurs fusionnés dans le nouvel objet
      newConfig.sensors[sensorType] = mergedSensorArray;
    });

    this.config = newConfig;
  }
}

customElements.define('pool-monitor-card', PoolMonitorCard);
