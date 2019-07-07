'use strict';
const Alexa = require('ask-sdk-v1adapter');
const rp = require('request-promise');
const unirest = require('unirest');
const striptags = require('striptags');
const dateTime = require('date-time');

const diets = [
  "vegetarian",
  "vegan",
  "gluten free",
  "dairy free",
  "very healthy",
  "cheap",
  "very popular",
  "sustainable",
  "low fodmap",
  "ketogenic",
  'paleo',
  'fresh',
  'atkins',
  'fat smash'
]

const APP_ID = 'amzn1.ask.skill.2a9642ad-e124-4aaf-be06-bbd36d080c40';

const HELP_MESSAGE = 'I can compose your daily menu, just tell me make daily menu... What can I help you with?';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';

const handlers = {
  'AMAZON.HelpIntent': function () {
    const speechOutput = HELP_MESSAGE;
    const reprompt = HELP_REPROMPT;

    this.response.speak(speechOutput).listen(reprompt);
    this.emit(':responseReady');
  },

  'AMAZON.FallbackIntent': function () {
    this.emit(':ask', 'Sorry, I don\'t know this command.')
  },

  'AMAZON.CancelIntent': function () {
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },

  'AMAZON.StopIntent': function () {
    this.response.speak(STOP_MESSAGE);
    this.emit(':responseReady');
  },

  'SessionEndedRequest': function () {
    this.emit(':saveState', true);  }
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const { accessToken } = handlerInput.requestEnvelope.context.System.user;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let speechText = '';
    if (!accessToken) {
      speechText = 'You must authenticate with your Amazon Account to use this skill. I sent instructions for how to do this in your Alexa App';
      return handlerInput.responseBuilder
        .speak(speechText)
        .withLinkAccountCard()
        .getResponse();
    } else {
      let url = `https://api.amazon.com/user/profile?access_token=${accessToken}`;
      await rp(url).then((body) => {
        let data = JSON.parse(body);
        sessionAttributes.email = data.email;
      });
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      let speechText = "Welcome to daily menu skill.";
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    }
  }
};

const DailyMenuIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'DailyMenuIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const realDate = dateTime().split(' ')[0];
    if (sessionAttributes.calories && sessionAttributes.diet) {
      if (sessionAttributes.date != realDate || !(sessionAttributes.date)) {
        let temp = sessionAttributes.diet.split(' ');
        let transformed_diet = (temp.length === 2) ? temp[0] + temp[1].charAt(0).toUpperCase() + temp[1].slice(1) : temp[0];
        let body = await unirest.get(`https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/mealplans/generate?timeFrame=day&targetCalories=${sessionAttributes.calories}&diet=${transformed_diet}&exclude=${sessionAttributes.allergy.join('%2') || ''}`)
        .header("X-RapidAPI-Host", "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com")
        .header("X-RapidAPI-Key", "7aa8330d21mshb36f54365067349p10827ajsn517135e75f47")
        .then((data) => {
          return data.body
        });
        sessionAttributes.breakfast = body.meals[0];
        sessionAttributes.lunch = body.meals[1];
        sessionAttributes.dinner = body.meals[2];
        sessionAttributes.date = realDate;
        sessionAttributes.nutrients = body.nutrients;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        let speechText = `I composed your menu for today! Breakfast: ${body.meals[0].title}, lunch: ${body.meals[1].title}, dinner: ${body.meals[2].title}`;
        return handlerInput.responseBuilder
          .speak(speechText)
          .withShouldEndSession(false)
          .getResponse();
      }
      let speechText = 'Your menu has already been composed.'
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    } else if (!sessionAttributes.calories) {
      return CaloriesLimitIntentHandler.handle(handlerInput, true)
    } else if (!sessionAttributes.diet) {
      return DietIntentHandler.handle(handlerInput, true)
    }
  }
};

const CaloriesLimitIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'CaloriesLimitIntent';
  },
  async handle(handlerInput, fromIntent=false) {
    if (fromIntent) {
      let speechText = 'Please, set your calories limit.'
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt('Please, set your calories limit.')
        .getResponse();
    }
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const  calories = handlerInput.requestEnvelope.request.intent.slots['num'].value;
    sessionAttributes.calories = calories;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    let speechText = `Your calories limit set to ${calories}`
    return handlerInput.responseBuilder
      .speak(speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
};

const DietIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'DietIntent';
  },
  async handle(handlerInput, fromIntent=false) {
    if (fromIntent) {
      let speechText = 'Please, set your diet type! You can see hole list of diets using command available diets.'
      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt('Please, set your diet type! You can see hole list of diets using command available diets.')
        .getResponse();
    }
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const diet = handlerInput.requestEnvelope.request.intent.slots['diet'].value;
    if (diets.includes(diet)) {
      sessionAttributes.diet = diet;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
      let speechText = `Your diet type set to ${diet}.`
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    } else {
      let speechText = `${diet} diet is not available. You can use available diets command to display available diets.`
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    }
  }
};

const AvailableDietsShowIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'AvailableDietsShowIntent';
  },
  async handle(handlerInput) {
    let speechText = `${diets.join()}`
    return handlerInput.responseBuilder
      .speak(speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
};

const AddAllergyIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'AddAllergyIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const allergy = handlerInput.requestEnvelope.request.intent.slots['allergy'].value;
    let allergy_list = sessionAttributes.allergy
    if (allergy_list) {
      if (allergy_list.includes(allergy)) {
        let speechText = `${allergy} is already in your allergy list.`
        return handlerInput.responseBuilder
          .speak(speechText)
          .withShouldEndSession(false)
          .getResponse();
      }
    }
    sessionAttributes.allergy ? sessionAttributes.allergy.push(allergy) : sessionAttributes.allergy = [allergy]
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    let speechText = `${allergy} added to your allergy list.`
    return handlerInput.responseBuilder
      .speak(speechText)
      .withShouldEndSession(false)
      .getResponse();
  }
};

const DeleteAllergyIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'DeleteAllergyIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const allergy = handlerInput.requestEnvelope.request.intent.slots['allergy'].value;
    let allergy_list = sessionAttributes.allergy
    let index = allergy_list ? allergy_list.indexOf(allergy) : -1;
    if (index > -1) {
      allergy_list.splice(index, 1)
      let speechText = `${allergy} removed from your allergy list.`
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    } else {
      let speechText = `You don't have ${allergy} in your allergy list.`
      return handlerInput.responseBuilder
        .speak(speechText)
        .withShouldEndSession(false)
        .getResponse();
    }
  }
};

const RecipeIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'RecipeIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const food = handlerInput.requestEnvelope.request.intent.slots['food'].value;
    const id = sessionAttributes[food].id
    let body = await unirest.get(`https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/${id}/information`)
    .header("X-RapidAPI-Host", "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com")
    .header("X-RapidAPI-Key", "7aa8330d21mshb36f54365067349p10827ajsn517135e75f47")
    .then((data) => {
      return data.body
    });
    let ingredients = [];
    let instruction = body.instructions;
    for (var i = 0; i < body.extendedIngredients.length; i++) {
      ingredients.push(body.extendedIngredients[i].originalString + '<break time="800ms"/>')
    }
    let speechText = `Ingredients: ${ingredients.join(', ')}. Instruction: ${instruction}`;
    return handlerInput.responseBuilder
      .speak(striptags(speechText))
      .withShouldEndSession(false)
      .getResponse();
  }
};

const SendInfoIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'SendInfoIntent';
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const food = handlerInput.requestEnvelope.request.intent.slots['food'].value;
    const id = sessionAttributes[food].id
    let body = await unirest.get(`https://spoonacular-recipe-food-nutrition-v1.p.rapidapi.com/recipes/${id}/information`)
    .header("X-RapidAPI-Host", "spoonacular-recipe-food-nutrition-v1.p.rapidapi.com")
    .header("X-RapidAPI-Key", "7aa8330d21mshb36f54365067349p10827ajsn517135e75f47")
    .then((data) => {
      return data.body
    });
    let ingredients = [];
    let instruction = body.instructions;
    for (var i = 0; i < body.extendedIngredients.length; i++) {
      ingredients.push(body.extendedIngredients[i].originalString + '<break time="800ms"/>')
    }
    ingredients = `Ingredients: ${ingredients.join(', ')}.`;
    instruction =  `Instruction: ${instruction}`;

  }

};

exports.handler = function(event, context, callback) {
  var alexa = Alexa.handler(event, context);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.registerV2Handlers(LaunchRequestHandler, DailyMenuIntentHandler, CaloriesLimitIntentHandler, DietIntentHandler, AvailableDietsShowIntentHandler, AddAllergyIntentHandler, DeleteAllergyIntentHandler, RecipeIntentHandler);
  alexa.dynamoDBTableName = 'daily_food';
  alexa.execute();
};
