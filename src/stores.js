import { writable } from "svelte/store";
import { v4 } from "uuid";

let app_server_address = "http://localhost:7777";

class AppState {
  dollar_model;
  currency_model;
  bot_model;

  constructor(dollar_model, currency_model, bot_model) {
    this.dollar_model = dollar_model;
    this.currency_model = currency_model;
    this.bot_model = bot_model;
  }
}

export class CurrencyRate {
  uid;
  currencyCode;
  alias_name;
  rate;
  has_manual_rate;
  manual_rate;
  adjustment;

  constructor(
    currencyCode,
    alias_name,
    rate,
    has_manual_rate,
    manual_rate,
    adjustment
  ) {
    this.uid = v4();
    this.currencyCode = currencyCode;
    this.alias_name = alias_name;
    this.rate = rate;
    this.has_manual_rate = has_manual_rate;
    this.manual_rate = manual_rate;
    this.adjustment = adjustment;
  }
}

export class DollarPrice {
  price;
  timestamp;

  constructor(price, timestamp) {
    this.uid = v4();
    this.price = price;
    this.timestamp = timestamp;
  }
}

export class BotInterval {
  unit;
  value;

  constructor(unit, value) {
    this.unit = unit;
    this.value = value;
  }
}

export const CurrencyStore = writable({
  selected_currencies: ["EUR", "TRY"],
  currency_rates: [
    new CurrencyRate("EUR", "1.05", false, 1, 500),
    new CurrencyRate("TRY", "19.01", true, 19.5, -200),
  ],
});

export const DollarStore = writable({
  current_price: new DollarPrice(48285, 1679161352),
  historic_prices: [
    new DollarPrice(47895, 1679218971),
    new DollarPrice(48890, 1679118971),
  ],
});

export const BotStore = writable({
  disabled: false,
  onTime: true,
  onChange: false,

  interval: new BotInterval("Min", 2),
});

export async function getStateFromServer() {
  let raw_res = await fetch(
    `${app_server_address}/api/get_state`
    // {mode: 'no-cors'}
  );

  if (!raw_res.ok) {
    console.log(raw_res.statusText);
    console.log(raw_res.status);
  }
  return await raw_res.json();
}

function dollarStoreDataAdapter(dollar_model) {
  let rec_historic_prices = [];

  for (let historic_price of dollar_model.historic_prices) {
    rec_historic_prices = [
      new DollarPrice(historic_price.price, historic_price.timestamp),
      ...rec_historic_prices,
    ];
  }

  rec_historic_prices.sort((a, b) => b.timestamp - a.timestamp);

  let new_dollar_state = {
    current_price: new DollarPrice(
      dollar_model.current_price.price,
      dollar_model.current_price.timestamp
    ),
    historic_prices: rec_historic_prices,
  };

  return new_dollar_state;
}

function botStoreDataAdapter(bot_model) {
  let interval = new BotInterval(
    bot_model.interval.unit,
    bot_model.interval.value
  );

  let new_bot_model = {
    disabled: bot_model.disabled,
    onChange: bot_model.onChange,
    onTime: bot_model.onTime,

    interval: interval,
  };

  return new_bot_model;
}

function currencyStoreDataAdapter(currency_model) {
  let received_currency_rates = [];

  for (let raw_model of currency_model.currency_rates) {
    let new_currency = new CurrencyRate(
      raw_model.currencyCode,
      raw_model.alias_name,
      raw_model.rate,
      raw_model.has_manual_rate,
      raw_model.manual_rate,
      raw_model.adjustment
    );
    received_currency_rates = [new_currency, ...received_currency_rates];
  }

  received_currency_rates = [
    ...received_currency_rates.sort((a, b) =>
      a.currencyCode.localeCompare(b.currencyCode)
    ),
  ];
  let new_currency_state = {
    selected_currencies: currency_model.selected_currencies,
    currency_rates: received_currency_rates,
  };
  return new_currency_state;
}

export async function reloadStateFromServer() {
  console.log("Getting state from server");
  let raw_state = await getStateFromServer();

  let new_dollar_state = dollarStoreDataAdapter(raw_state.dollar_model);
  let new_bot_state = botStoreDataAdapter(raw_state.bot_model);
  let new_currency_state = currencyStoreDataAdapter(raw_state.currency_model);

  DollarStore.update((currentState) => {
    return new_dollar_state;
  });

  BotStore.update((currentState) => {
    return new_bot_state;
  });

  CurrencyStore.update((currentState) => {
    return new_currency_state;
  });

  return raw_state;
}

let app_state = new AppState(null, null, null);

export function startUpdatingAppState() {
  let dollarSub = DollarStore.subscribe((dollar_model) => {
    app_state.dollar_model = dollar_model;
  });
  let currencySub = CurrencyStore.subscribe((currency_model) => {
    app_state.currency_model = {
      selected_currencies: currency_model.selected_currencies,
      currency_rates: [...currency_model.currency_rates],
    };
  });
  let botSub = BotStore.subscribe((bot_model) => {
    app_state.bot_model = bot_model;
  });
}

export async function sendStateToServer() {
  console.log("Sending state to server");
  let app_state_json = JSON.stringify(app_state);
  let raw_res = await fetch(`${app_server_address}/api/send_state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: app_state_json,
  });

}
